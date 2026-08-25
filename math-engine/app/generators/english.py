"""English Language generator — locale-aware for England, US, and Ontario.

Sub-skills:
- comprehension: reading comprehension (find evidence, infer, summarise)
- analysis: language/technique analysis (metaphor, simile, personification)
- writing: short writing tasks (paragraph writing, descriptive, persuasive)
- SPaG/grammar: spelling, punctuation and grammar

England: UK SPaG style (semi-colons, colons, fronted adverbials),
AQA/Edexcel GCSE English Language paper 1 style comprehension.
US: Common Core ELA — argumentative/informational/narrative text types,
vocabulary in context, text structure analysis, grammar conventions.
Ontario: Ontario curriculum — similar to US but with Canadian spelling
and Ontario-specific curriculum references (e.g. "Mediacy" framework).

All answers are model answers verified for quality, not numeric.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class EnglishGenerator(BaseGenerator):
    generator_key = "english"
    topic_name = "English Language"
    supported_sub_skills = [
        "comprehension",
        "analysis",
        "writing",
        "spag",
    ]

    def generate_questions(self, count: int) -> list[Question]:
        questions = []
        sub_skills = self._shuffle(self.supported_sub_skills)
        for i in range(count):
            sub_skill = sub_skills[i % len(sub_skills)]
            q = self._make_question(i + 1, sub_skill)
            questions.append(q)
        return questions

    def _make_question(self, q_num: int, sub_skill: str) -> Question:
        if self.locale == "united_states":
            return self._us_question(q_num, sub_skill)
        elif self.locale == "canada_ontario":
            return self._ontario_question(q_num, sub_skill)
        return self._england_question(q_num, sub_skill)

    # ------------------------------------------------------------------
    # England
    # ------------------------------------------------------------------

    def _england_question(self, q_num: int, sub_skill: str) -> Question:
        if sub_skill == "comprehension":
            return self._eng_comprehension(q_num, sub_skill)
        elif sub_skill == "analysis":
            return self._eng_analysis(q_num, sub_skill)
        elif sub_skill == "writing":
            return self._eng_writing(q_num, sub_skill)
        return self._eng_spag(q_num, sub_skill)

    def _eng_comprehension(self, q_num: int, sub_skill: str) -> Question:
        passages = [
            {
                "passage": (
                    "The old lighthouse stood at the edge of the cliff, its paint peeling "
                    "like sunburnt skin. Below, the sea crashed against the rocks with a "
                    "rhythm that had not changed in a hundred years. Inside, the lamp "
                    "still turned, casting long shadows across the dusty spiral staircase."
                ),
                "q": "Suggest what the writer means by 'a rhythm that had not changed in a hundred years'.",
                "model": "The writer is suggesting that the sea is constant and unchanging, while everything around it (the lighthouse, the paint, the dust) is decaying. This creates a contrast between the permanence of nature and the impermanence of human structures.",
                "marks": 2,
            },
            {
                "passage": (
                    "Maria pressed her nose against the glass. The bakery window glowed "
                    "with warm light, and inside she could see trays of golden pastries "
                    "cooling on wire racks. The smell of cinnamon and sugar drifted "
                    "through the open door, making her stomach grow despite the large "
                    "lunch she had eaten only an hour before."
                ),
                "q": "How does the writer show that Maria wants the pastries? Find and quote one piece of evidence.",
                "model": "Her stomach growled 'despite the large lunch she had eaten only an hour before' — this shows she wants the pastries even though she is not hungry.",
                "marks": 2,
            },
            {
                "passage": (
                    "The train pulled away from the station with a hiss of steam. "
                    "Thomas watched the platform slide backwards, his mother's waving "
                    "hand growing smaller and smaller until it was just another shape "
                    "in the crowd. He turned away quickly and pretended to read his "
                    "book, blinking hard."
                ),
                "q": "What does 'blinking hard' suggest about Thomas's feelings?",
                "model": "Thomas is trying to hold back tears. He is upset about leaving his mother but does not want anyone on the train to see him crying, so he pretends to read.",
                "marks": 2,
            },
        ]
        d = passages[q_num % len(passages)]
        parts = [
            QuestionPart(
                part_label="a",
                text=f"Read this passage carefully.\n\n*\"{d['passage']}\"*\n\n{d['q']}",
                marks=d["marks"],
                diagram_spec=None,
                working_lines=4,
                answer=d["model"],
                answer_format="extended",
                mark_scheme=MarkScheme(
                    M1="State the inference or meaning clearly",
                    A1="Support with a quotation from the text",
                    common_error="Retelling the plot instead of explaining the effect",
                    allow=d["model"],
                ),
            )
        ]
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=parts)

    def _eng_analysis(self, q_num: int, sub_skill: str) -> Question:
        techniques = [
            {
                "text": "The wind whispered through the trees, telling secrets only the leaves could understand.",
                "technique": "personification",
                "q": "Identify the technique used in this sentence and explain its effect.",
                "model": "The writer uses personification by giving the wind human qualities ('whispered', 'telling secrets'). This makes the scene feel alive and mysterious, as if nature has its own hidden life.",
                "marks": 3,
            },
            {
                "text": "The city was a beehive, every street humming with energy and purpose.",
                "technique": "simile",
                "q": "What does this simile suggest about the city? Explain your answer.",
                "model": "Comparing the city to a beehive suggests it is busy, organised, and full of activity. The word 'humming' reinforces this, creating a sense of constant movement and noise.",
                "marks": 3,
            },
            {
                "text": "His words were daggers, each one landing exactly where it would hurt most.",
                "technique": "metaphor",
                "q": "The writer describes words as 'daggers'. What is the effect of this metaphor?",
                "model": "The metaphor suggests the words were deliberately hurtful and caused emotional pain. Daggers are sharp and dangerous, so comparing words to them shows the speaker intended to cause damage.",
                "marks": 3,
            },
        ]
        t = techniques[q_num % len(techniques)]
        part = QuestionPart(
            part_label=None,
            text=f"Read this sentence:\n\n*\"{t['text']}\"*\n\n{t['q']}",
            marks=t["marks"],
            diagram_spec=None,
            working_lines=4,
            answer=t["model"],
            answer_format="extended",
            mark_scheme=MarkScheme(
                M1=f"Identify the technique: {t['technique']}",
                A1="Explain the effect on the reader with reference to the words used",
                common_error="Naming the technique without explaining its effect",
                allow=t["model"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    def _eng_writing(self, q_num: int, sub_skill: str) -> Question:
        tasks = [
            {
                "q": (
                    "Write a descriptive paragraph about a busy market. "
                    "Use at least two different senses (sight, sound, smell, touch, taste). "
                    "Aim for 5-8 sentences."
                ),
                "model": (
                    "A strong answer would describe the market using multiple senses: "
                    "sights (colourful stalls, towering piles of fruit), sounds (vendors calling, "
                    "music from a speaker), smells (fresh bread, spices). "
                    "It should use varied sentence structures and at least one figurative language device."
                ),
                "marks": 5,
            },
            {
                "q": (
                    "Write a persuasive paragraph arguing that school uniforms should be optional. "
                    "Include at least one reason, one piece of evidence or example, and a concluding statement."
                ),
                "model": (
                    "A strong answer would give a clear reason (e.g. self-expression), "
                    "support it with evidence or an example, and end with a persuasive concluding "
                    "statement. It should use persuasive techniques such as rhetorical questions "
                    "or emotive language."
                ),
                "marks": 5,
            },
            {
                "q": (
                    "Write a short diary entry from the perspective of someone arriving "
                    "in a new country where they do not speak the language. "
                    "Show how the character feels through what they describe."
                ),
                "model": (
                    "A strong answer would show feelings through description rather than "
                    "stating them directly (e.g. 'the signs on the wall meant nothing to me' "
                    "to show confusion). It should use first person, past tense, and "
                    "include sensory details."
                ),
                "marks": 5,
            },
        ]
        t = tasks[q_num % len(tasks)]
        part = QuestionPart(
            part_label=None,
            text=t["q"],
            marks=t["marks"],
            diagram_spec=None,
            working_lines=8,
            answer=t["model"],
            answer_format="extended",
            mark_scheme=MarkScheme(
                M1="Clear structure and purpose",
                A1="Evidence of varied vocabulary, sentence structures, and/or figurative language",
                common_error="Writing too short or not addressing the task",
                allow=t["model"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    def _eng_spag(self, q_num: int, sub_skill: str) -> Question:
        questions = [
            {
                "q": "Circle the spelling mistake in this sentence and write the correct spelling: 'The definately went to the shops.'",
                "answer": "definitely",
                "model": "definitely (not 'definately')",
                "marks": 1,
            },
            {
                "q": "Add the correct punctuation to this sentence: the teacher said the homework was due on friday",
                "answer": 'The teacher said, "The homework was due on Friday."',
                "model": "Capital letter, speech marks, comma, capital letter for speech, full stop inside speech marks, capital F for Friday.",
                "marks": 2,
            },
            {
                "q": "Identify the verb in this sentence: 'The ancient castle towered over the village.'",
                "answer": "towered",
                "model": "towered (the action word)",
                "marks": 1,
            },
            {
                "q": "Rewrite this sentence using a semi-colon: 'I love reading it helps me relax'",
                "answer": "I love reading; it helps me relax.",
                "model": "A semi-colon connects two related independent clauses.",
                "marks": 1,
            },
            {
                "q": "What is the plural of 'cactus'?",
                "answer": "cacti",
                "model": "cacti (Latin-origin plural)",
                "marks": 1,
            },
        ]
        q_data = questions[q_num % len(questions)]
        part = QuestionPart(
            part_label=None,
            text=q_data["q"],
            marks=q_data["marks"],
            diagram_spec=None,
            working_lines=2,
            answer=q_data["answer"],
            answer_format="text",
            mark_scheme=MarkScheme(
                M1=q_data["model"],
                A1=q_data["answer"],
                common_error="Common SPaG errors",
                allow=q_data["answer"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    # ------------------------------------------------------------------
    # United States (Common Core ELA)
    # ------------------------------------------------------------------

    def _us_question(self, q_num: int, sub_skill: str) -> Question:
        if sub_skill == "comprehension":
            return self._us_comprehension(q_num, sub_skill)
        elif sub_skill == "analysis":
            return self._us_analysis(q_num, sub_skill)
        elif sub_skill == "writing":
            return self._us_writing(q_num, sub_skill)
        return self._us_grammar(q_num, sub_skill)

    def _us_comprehension(self, q_num: int, sub_skill: str) -> Question:
        passages = [
            {
                "passage": (
                    "The Arctic tern migrates farther than any other bird, traveling from "
                    "the Arctic to the Antarctic and back each year — a round trip of about "
                    "22,000 miles. Over its lifetime, an Arctic tern may fly the equivalent "
                    "of three round trips to the moon."
                ),
                "q": "What is the main idea of this passage? Cite specific details from the text to support your answer.",
                "model": "The main idea is that Arctic terns migrate extraordinary distances. The passage supports this with the statistic of 22,000 miles per round trip and the comparison to three round trips to the moon over a lifetime, which emphasizes just how far these birds travel.",
                "marks": 3,
            },
            {
                "passage": (
                    "Maya looked at the clock: 7:58 a.m. The bus would arrive in two minutes. "
                    "She grabbed her backpack, shoved her lunch inside, and sprinted toward "
                    "the door. Her mother's voice followed her down the driveway: 'Maya, your "
                    "project!' But Maya was already gone, her sneakers pounding the sidewalk."
                ),
                "q": "How does the author develop Maya's character in this passage? Use at least two details from the text.",
                "model": "The author shows Maya is impulsive and energetic through her actions — she grabs her things quickly and sprints out without waiting. She also seems forgetful or distracted since she leaves her project behind, showing she acts before thinking things through.",
                "marks": 3,
            },
            {
                "passage": (
                    "In 1969, engineers at ARPANET sent the first message between two "
                    "computers at UCLA and Stanford. The system crashed after just two "
                    "letters — they tried to type 'LOGIN' but only managed 'LO' before "
                    "the network failed. It would take another hour to get the full "
                    "system working again."
                ),
                "q": "What does this passage reveal about the early development of computer networks? What can you infer about the challenges of early technology?",
                "model": "The passage reveals that early computer networking was fragile and unreliable — even sending a single word caused a crash. We can infer that developing new technology involves frequent failures and that progress is gradual, since it took an hour to recover from a two-letter message.",
                "marks": 3,
            },
        ]
        d = passages[q_num % len(passages)]
        parts = [
            QuestionPart(
                part_label="a",
                text=f"Read the passage below carefully.\n\n*\"{d['passage']}\"*\n\n{d['q']}",
                marks=d["marks"],
                diagram_spec=None,
                working_lines=5,
                answer=d["model"],
                answer_format="extended",
                mark_scheme=MarkScheme(
                    M1="Identify the main idea or author's purpose with a clear claim",
                    A1="Support the claim with at least two specific details quoted or paraphrased from the text",
                    common_error="Summarizing the passage instead of analyzing it",
                    allow=d["model"],
                ),
            )
        ]
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=parts)

    def _us_analysis(self, q_num: int, sub_skill: str) -> Question:
        texts = [
            {
                "text": "The old oak tree had witnessed a century of change — wars fought and won, families grown and scattered, seasons turning like pages in a book too large to read in one lifetime.",
                "technique": "extended metaphor",
                "q": "The author compares the oak tree's life to reading a book. What is the effect of this extended metaphor? How does it help the reader understand the passage of time?",
                "model": "The extended metaphor compares the tree's long life to reading a book that is too large to finish at once, suggesting the tree has seen so much history that it cannot be fully understood in a single moment. This helps the reader grasp the immense span of time the tree has lived through and creates a sense of awe about the natural world's endurance.",
                "marks": 4,
            },
            {
                "text": "The laboratory hummed with the quiet intensity of people doing important work. Beakers caught the light from overhead fluorescents, and the sharp smell of chemicals hung in the air like a warning.",
                "technique": "imagery and connotation",
                "q": "How does the author use imagery to create a specific mood in this passage? Identify two sensory details and explain how they contribute to the mood.",
                "model": "The author creates a mood of focused tension and slight danger. The visual imagery ('beakers caught the light') suggests precision and care, while the smell of chemicals 'hung in the air like a warning' uses negative connotation to hint at potential danger. Together, these details make the laboratory feel both impressive and slightly threatening.",
                "marks": 4,
            },
            {
                "text": "Despite the rain, despite the mud, despite the aching in her legs, Keisha kept running. One foot in front of the other. That was all she could do.",
                "technique": "repetition and syntax",
                "q": "The author repeats 'despite' three times. What is the effect of this repetition on the reader? How does the short final sentence contribute?",
                "model": "The repetition of 'despite' emphasizes the obstacles Keisha faces and builds a sense of determination — she keeps going even as the challenges pile up. The short final sentence ('That was all she could do') strips away everything except raw perseverance, creating a powerful, understated conclusion that shows her resilience without describing it.",
                "marks": 4,
            },
        ]
        t = texts[q_num % len(texts)]
        part = QuestionPart(
            part_label=None,
            text=f"Read the passage below.\n\n*\"{t['text']}\"*\n\n{t['q']}",
            marks=t["marks"],
            diagram_spec=None,
            working_lines=5,
            answer=t["model"],
            answer_format="extended",
            mark_scheme=MarkScheme(
                M1=f"Identify the technique: {t['technique']}",
                A1="Explain how the technique creates meaning or effect, using specific words from the text",
                common_error="Naming the technique without explaining its effect on the reader",
                allow=t["model"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    def _us_writing(self, q_num: int, sub_skill: str) -> Question:
        tasks = [
            {
                "q": (
                    "Write an argumentative paragraph explaining whether students should have "
                    "homework on weekends. State your position, provide at least one reason "
                    "with supporting evidence or an example, and end with a concluding statement."
                ),
                "model": (
                    "A strong argumentative paragraph states a clear position (for or against), "
                    "supports it with a logical reason and evidence (a fact, example, or expert "
                    "opinion), and ends with a conclusion that restates the argument. "
                    "Common Core ELA requires claim, evidence, and reasoning."
                ),
                "marks": 5,
            },
            {
                "q": (
                    "Write a narrative paragraph about a character who discovers something unexpected "
                    "in their backyard. Use descriptive details to show the character's reaction "
                    "without stating their emotions directly."
                ),
                "model": (
                    "A strong narrative paragraph uses show-don't-tell: instead of writing "
                    "'she was excited,' describe her actions (widened eyes, quick breathing, "
                    "reaching out to touch the discovery). It should include sensory details "
                    "and advance a brief moment of story."
                ),
                "marks": 5,
            },
            {
                "q": (
                    "Write an informational paragraph explaining how a volcano forms. "
                    "Use at least one domain-specific vocabulary word (e.g. magma, tectonic, "
                    "eruption) and include a concluding sentence."
                ),
                "model": (
                    "A strong informational paragraph explains a process in logical order "
                    "(cause to effect or step by step), uses domain-specific vocabulary "
                    "correctly, and ends with a concluding sentence that summarizes the main point."
                ),
                "marks": 5,
            },
        ]
        t = tasks[q_num % len(tasks)]
        part = QuestionPart(
            part_label=None,
            text=t["q"],
            marks=t["marks"],
            diagram_spec=None,
            working_lines=8,
            answer=t["model"],
            answer_format="extended",
            mark_scheme=MarkScheme(
                M1="Clear structure appropriate to the text type (argumentative, narrative, or informational)",
                A1="Evidence of grade-appropriate vocabulary, conventions, and text-type features",
                common_error="Not following the structure of the requested text type",
                allow=t["model"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    def _us_grammar(self, q_num: int, sub_skill: str) -> Question:
        questions = [
            {
                "q": "Identify the complete subject and complete predicate in this sentence: 'The tall oak tree in the park lost its leaves.'",
                "answer": "Subject: The tall oak tree in the park; Predicate: lost its leaves",
                "model": "The complete subject includes all words that describe who or what the sentence is about. The complete predicate includes the verb and all words that follow it.",
                "marks": 2,
            },
            {
                "q": "Choose the correct homophone: 'The students (their / there / they're) going on a field trip (to / too / two) the museum.'",
                "answer": "they're going on a field trip to the museum",
                "model": "'they're' = they are; 'to' = direction/destination. 'their' = possessive, 'there' = place, 'too' = also/excessive, 'two' = number.",
                "marks": 2,
            },
            {
                "q": "Rewrite this sentence to fix the run-on: 'I wanted to go to the park it was raining really hard'",
                "answer": "I wanted to go to the park, but it was raining really hard.",
                "model": "The sentence can be fixed with a comma and coordinating conjunction (FANBOYS), a semicolon, or by splitting into two sentences.",
                "marks": 2,
            },
            {
                "q": "What is the correct plural form of 'leaf'?",
                "answer": "leaves",
                "model": "leaves (nouns ending in -f or -fe typically change to -ves in the plural)",
                "marks": 1,
            },
            {
                "q": "Identify the type of sentence: 'Could you please pass the salt?'",
                "answer": "interrogative",
                "model": "interrogative (a sentence that asks a question, ending with a question mark)",
                "marks": 1,
            },
        ]
        q_data = questions[q_num % len(questions)]
        part = QuestionPart(
            part_label=None,
            text=q_data["q"],
            marks=q_data["marks"],
            diagram_spec=None,
            working_lines=3,
            answer=q_data["answer"],
            answer_format="text",
            mark_scheme=MarkScheme(
                M1=q_data["model"],
                A1=q_data["answer"],
                common_error="Common grammar and usage errors",
                allow=q_data["answer"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    # ------------------------------------------------------------------
    # Ontario (Canadian curriculum)
    # ------------------------------------------------------------------

    def _ontario_question(self, q_num: int, sub_skill: str) -> Question:
        if sub_skill == "comprehension":
            return self._ont_comprehension(q_num, sub_skill)
        elif sub_skill == "analysis":
            return self._ont_analysis(q_num, sub_skill)
        elif sub_skill == "writing":
            return self._ont_writing(q_num, sub_skill)
        return self._ont_grammar(q_num, sub_skill)

    def _ont_comprehension(self, q_num: int, sub_skill: str) -> Question:
        passages = [
            {
                "passage": (
                    "The Halliburton Bass Lake ecosystem supports a surprising diversity of life "
                    "for a Canadian Shield lake. Walleye and northern pike patrol the deeper "
                    "channels, while painted turtles sun themselves on half-submerged logs near "
                    "the shore. In spring, loons return to nest on the rocky islands, their "
                    "calls echoing across the water at dawn."
                ),
                "q": "What can you infer about the importance of Halliburton Bass Lake to the local ecosystem? Use details from the passage to support your inference.",
                "model": "The passage suggests the lake is an important habitat for many species — fish, reptiles, and birds all depend on it. The mention of specific species (walleye, pike, painted turtles, loons) and their different habitats within the same lake (deep channels, shoreline, rocky islands) shows the lake supports a complex, interconnected ecosystem.",
                "marks": 3,
            },
            {
                "passage": (
                    "When the Underground Railroad reached St. Catharines, Ontario, many "
                    "freed people chose to stay. They built homes, opened businesses, and "
                    "created churches. Their presence shaped the character of the town for "
                    "generations to come."
                ),
                "q": "What does the author suggest about the long-term impact of the Underground Railroad on Canadian communities? Cite evidence from the passage.",
                "model": "The author suggests that the arrivals didn't just pass through — they settled permanently and contributed to the community's growth. The phrase 'shaped the character of the town for generations' indicates the impact was lasting and fundamental, not temporary.",
                "marks": 3,
            },
            {
                "passage": (
                    "The TTC streetcar rattled down Queen Street, its windows fogged with "
                    "the breath of forty passengers. Outside, the January wind cut through "
                    "wool coats and scarves, but inside it was warm, almost too warm, "
                    "and the hum of conversation made the slow journey feel like a kind "
                    "of community."
                ),
                "q": "How does the author use contrast in this passage to create a sense of community?",
                "model": "The author contrasts the cold, harsh outside ('January wind cut through wool coats') with the warm, crowded interior ('almost too warm'). This contrast makes the streetcar feel like a refuge, and the shared experience of warmth and conversation among strangers creates a feeling of community — people brought together by the weather and the slow ride.",
                "marks": 3,
            },
        ]
        d = passages[q_num % len(passages)]
        parts = [
            QuestionPart(
                part_label="a",
                text=f"Read the passage below carefully.\n\n*\"{d['passage']}\"*\n\n{d['q']}",
                marks=d["marks"],
                diagram_spec=None,
                working_lines=5,
                answer=d["model"],
                answer_format="extended",
                mark_scheme=MarkScheme(
                    M1="Make a clear inference or identify the main idea",
                    A1="Support with at least one specific detail from the text",
                    common_error="Retelling the events instead of explaining their significance",
                    allow=d["model"],
                ),
            )
        ]
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=parts)

    def _ont_analysis(self, q_num: int, sub_skill: str) -> Question:
        texts = [
            {
                "text": "The maple leaf had turned the colour of a sunset — deep reds melting into orange, edges curled like paper left too close to a flame.",
                "technique": "simile and sensory imagery",
                "q": "How does the author use simile and imagery to describe the maple leaf? What effect does this create for the reader?",
                "model": "The simile 'like paper left too close to a flame' and the colour comparison to a sunset create a vivid visual image. The effect is both beautiful and fragile — the leaf is gorgeous but also dying, which creates a bittersweet tone about the transition from autumn to winter.",
                "marks": 3,
            },
            {
                "text": "The canoe sliced through the morning mist on Algonquin's Canoe Lake, leaving a dark V-shaped wake that dissolved behind us like a memory fading in the telling.",
                "technique": "metaphor and imagery",
                "q": "The author compares the wake of a canoe to 'a memory fading in the telling.' What does this metaphor suggest about the experience?",
                "model": "The metaphor suggests the moment is beautiful but fleeting — the wake exists briefly and then disappears, just as a memory becomes less vivid the more you try to describe it. This creates a sense of nostalgia and the passage of time, and connects the natural experience to something deeply personal.",
                "marks": 3,
            },
            {
                "text": "She had been counting the days since the last snowstorm — not with dread, but with the quiet anticipation of someone who knows that spring in Ontario is never as far away as it seems.",
                "technique": "tone and connotation",
                "q": "What tone does the author establish in this passage? Identify one word or phrase that contributes to this tone and explain its effect.",
                "model": "The tone is hopeful and patient. The phrase 'quiet anticipation' establishes this — it suggests calm, steady hope rather than impatient waiting. The final clause ('never as far away as it seems') reinforces optimism and suggests the speaker has experience with Ontario winters and knows they always end.",
                "marks": 3,
            },
        ]
        t = texts[q_num % len(texts)]
        part = QuestionPart(
            part_label=None,
            text=f"Read the passage below.\n\n*\"{t['text']}\"*\n\n{t['q']}",
            marks=t["marks"],
            diagram_spec=None,
            working_lines=5,
            answer=t["model"],
            answer_format="extended",
            mark_scheme=MarkScheme(
                M1=f"Identify the technique or tone: {t['technique']}",
                A1="Explain how it creates meaning, using specific words from the text",
                common_error="Identifying the technique without explaining its effect",
                allow=t["model"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    def _ont_writing(self, q_num: int, sub_skill: str) -> Question:
        tasks = [
            {
                "q": (
                    "Write a descriptive paragraph about a winter scene in Ontario. "
                    "Use at least two sensory details (sight, sound, smell, touch, taste) "
                    "and include a comparison (simile or metaphor)."
                ),
                "model": (
                    "A strong answer describes the scene using multiple senses — the crunch "
                    "of snow underfoot (sound), the sting of cold air on cheeks (touch), the "
                    "blue-white gleam of fresh snow (sight). It includes a comparison such as "
                    "'the snow sparkled like scattered钻石' and uses varied sentence structures."
                ),
                "marks": 5,
            },
            {
                "q": (
                    "Write a persuasive paragraph arguing that outdoor education should be "
                    "a required part of every Ontario school week. Include a clear position, "
                    "a reason, and a supporting example or fact."
                ),
                "model": (
                    "A strong persuasive paragraph states a clear position, gives a logical "
                    "reason (physical health, mental health, environmental awareness), supports "
                    "it with evidence or an example, and concludes by restating the argument. "
                    "It should use persuasive techniques such as rhetorical questions or "
                    "emotive language."
                ),
                "marks": 5,
            },
            {
                "q": (
                    "Write a short letter to a friend describing an event you attended recently. "
                    "Use past tense, include at least one direct quote, and describe how the "
                    "event made you feel."
                ),
                "model": (
                    "A strong letter uses a friendly, personal tone, includes specific details "
                    "about the event, uses at least one direct quote from a conversation, and "
                    "shows feelings through description rather than stating them. "
                    "It should be written in past tense and use Canadian spelling conventions."
                ),
                "marks": 5,
            },
        ]
        t = tasks[q_num % len(tasks)]
        part = QuestionPart(
            part_label=None,
            text=t["q"],
            marks=t["marks"],
            diagram_spec=None,
            working_lines=8,
            answer=t["model"],
            answer_format="extended",
            mark_scheme=MarkScheme(
                M1="Clear structure and purpose appropriate to the task",
                A1="Evidence of varied vocabulary, sensory details, and grade-appropriate conventions",
                common_error="Writing too short or not addressing the task requirements",
                allow=t["model"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    def _ont_grammar(self, q_num: int, sub_skill: str) -> Question:
        questions = [
            {
                "q": "Identify the subject and predicate in this sentence: 'The Canadian geese flew south for the winter.'",
                "answer": "Subject: The Canadian geese; Predicate: flew south for the winter",
                "model": "The subject is who or what the sentence is about. The predicate tells what the subject does or is.",
                "marks": 2,
            },
            {
                "q": "Choose the correct word: 'The cheque was (cancelled / canceled) by the bank.'",
                "answer": "cancelled",
                "model": "In Canadian English, 'cancelled' with double L is the standard spelling (British convention). American English uses 'canceled' with one L.",
                "marks": 1,
            },
            {
                "q": "Rewrite this sentence to fix the comma splice: 'It was a cold day, we stayed inside and played board games.'",
                "answer": "It was a cold day, so we stayed inside and played board games.",
                "model": "A comma splice can be fixed with a coordinating conjunction (and, but, so, or, for, yet, nor), a semicolon, or by making two separate sentences.",
                "marks": 2,
            },
            {
                "q": "What is the correct past tense of 'colour' in a sentence? (e.g. 'The sky ______ blue yesterday.')",
                "answer": "coloured",
                "model": "Canadian English uses the '-oured' spelling: coloured, favour, honour. The past tense adds -ed.",
                "marks": 1,
            },
            {
                "q": "Identify the type of sentence: 'What a beautiful day it is!'",
                "answer": "exclamatory",
                "model": "exclamatory (a sentence that expresses strong feeling, ending with an exclamation mark)",
                "marks": 1,
            },
        ]
        q_data = questions[q_num % len(questions)]
        part = QuestionPart(
            part_label=None,
            text=q_data["q"],
            marks=q_data["marks"],
            diagram_spec=None,
            working_lines=3,
            answer=q_data["answer"],
            answer_format="text",
            mark_scheme=MarkScheme(
                M1=q_data["model"],
                A1=q_data["answer"],
                common_error="Common grammar and spelling errors",
                allow=q_data["answer"],
            ),
        )
        return Question(id=f"q{q_num}", type=self._q_type(q_num), sub_skill=sub_skill, parts=[part])

    # ------------------------------------------------------------------
    # Shared
    # ------------------------------------------------------------------

    def _q_type(self, q_num: int) -> str:
        if q_num <= 2:
            return "warm-up"
        elif q_num <= 8:
            return "core"
        return "challenge"
