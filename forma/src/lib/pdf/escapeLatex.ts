// Security boundary for the LaTeX PDF pipeline: every AI-generated free-text
// field (question text, answers, mark scheme lines, alignment notes, topic
// strings...) passes through here before being interpolated into a .tex
// document that a real LaTeX engine compiles. This is defense in depth, not
// the only layer - the compile service (latex-service/) also runs with
// shell-escape permanently disabled, so even a control sequence that slips
// past this function can't execute a shell command. But a stray unescaped
// '%' or '&' from ordinary AI-written English (e.g. "20% of students",
// "AT&T") would silently corrupt or truncate the compiled document, so this
// still has to run on every field, every time - it isn't optional the way
// an HTML-escaping pass sometimes is for already-trusted strings.
//
// The system prompt (systemPrompt.ts) tells the model to write maths as
// inline $...$/\(...\) LaTeX and otherwise write plain English - explicitly
// NOT to hand-escape LaTeX special characters itself. That means escaping
// is entirely this function's responsibility: math spans must survive
// byte-for-byte (escaping "$x^2$" would corrupt real math), while
// everything outside them gets the standard LaTeX special-character
// treatment.

// Matches a $...$ or \(...\) math span, non-greedy. Deliberately doesn't try
// to handle escaped \$ inside math (the AI is never asked to produce one) -
// a stray unpaired '$' (e.g. someone writes "$5" using it as a currency
// symbol) simply won't match this and falls through to the plain-text
// escaping pass below, which correctly turns it into '\$'.
const MATH_SPAN = /(\$[^$]+\$|\\\([\s\S]*?\\\))/g;

// Command names that should never appear in AI-generated worksheet content -
// none of them are needed to typeset a worksheet, and several are direct
// injection primitives (\input/\include read arbitrary files, \write can
// write them, \csname/\catcode/\let/\def can redefine other commands to
// route around this same filter). Stripped regardless of whether they
// appear inside or outside a math span - unlike the character-escaping
// below, this MUST run before math spans are treated as "trusted", since a
// math span is only trusted to contain math, not arbitrary control
// sequences.
const DANGEROUS_COMMANDS = ['input', 'include', 'write\\d*', 'catcode', 'csname', 'endcsname', 'immediate', 'usepackage', 'RequirePackage', 'def', 'edef', 'gdef', 'xdef', 'let'];
const DANGEROUS_COMMAND_ALTERNATION = DANGEROUS_COMMANDS.join('|');

// Best-effort: strips the command plus up to three immediately-following
// {...}/[...] argument groups. Doesn't handle nested braces inside an
// argument (e.g. \def\foo{\bar{baz}} leaves the inner "{baz}" behind as
// literal text) - a full brace-matching parser is more than this warrants
// given the compile service's shell-escape is already permanently off and
// these are short, single-field strings, not full documents. The catch-all
// pass below removes the bare command token even where this one doesn't
// cleanly consume its arguments, which is what actually neutralizes it: an
// orphaned "{baz}" left over is just inert literal text once the
// character-escaping pass below turns its braces into "\{baz\}".
const DANGEROUS_COMMAND_WITH_ARGS = new RegExp(`\\\\(?:${DANGEROUS_COMMAND_ALTERNATION})\\b(?:\\s*\\{[^{}]*\\}){0,3}(?:\\s*\\[[^[\\]]*\\])?`, 'g');
const DANGEROUS_COMMAND_BARE = new RegExp(`\\\\(?:${DANGEROUS_COMMAND_ALTERNATION})\\b`, 'g');

function stripDangerousCommands(value: string): string {
  return value.replace(DANGEROUS_COMMAND_WITH_ARGS, '').replace(DANGEROUS_COMMAND_BARE, '');
}

// A single-pass replace via callback, not chained .replace() calls: several
// of these substitutions introduce their own backslashes and braces (e.g.
// '\' -> '\textbackslash{}'), and a later .replace() in a chain would
// re-match and mangle those newly-inserted characters. Scanning the
// original string exactly once, character by character, means each
// replacement's own output is never re-scanned.
const LATEX_SPECIAL_CHARS = /[\\{}$&#_%~^]/g;
const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  _: '\\_',
  '%': '\\%',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

function escapeLatexChars(value: string): string {
  return value.replace(LATEX_SPECIAL_CHARS, (char) => LATEX_ESCAPES[char]);
}

export function escapeLatexOutsideMath(rawText: string): string {
  const stripped = stripDangerousCommands(rawText);

  return stripped
    .split(MATH_SPAN)
    .map((segment, index) => {
      // String.split with a capturing regex alternates
      // [text, match, text, match, ..., text] - odd indices are the
      // captured math spans, left untouched; even indices are plain text.
      const isMathSpan = index % 2 === 1;
      return isMathSpan ? segment : escapeLatexChars(segment);
    })
    .join('');
}
