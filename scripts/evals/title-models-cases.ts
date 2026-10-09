import type { ModelMessage } from "ai"
export type TitleCase = {
    id: string
    category: string
    // Difficulty ladder for math and science cases.
    level?: "basic" | "school" | "undergrad" | "grad" | "research"
    messages: ModelMessage[]
    persona?: { name: string; description: string; instructions: string }
    // Loose relevance signals: a good title usually matches `expect` and never matches `avoid`.
    expect?: RegExp
    avoid?: RegExp
    // Scripts a good title may switch into, e.g. Arabic script for an Arabizi question.
    allowScripts?: string[]
    // The user's own romanized words; a title that keeps their form should reuse at least one.
    userSpellings?: RegExp
}
const u = (content: string): ModelMessage => ({ role: "user", content })
const a = (content: string): ModelMessage => ({ role: "assistant", content })
const file = (name: string, body: string) => `<file name="${name}">${body}</file>`
const GENERIC = /\b(chat|conversation|roleplay|discussion|inquiry)\b/i

const mara = {
    name: "Captain Mara Vale",
    description: "A weathered smuggler captain in a fantasy port city.",
    instructions:
        "Stay in character as Mara. Speak tersely, with nautical slang. Drive scenes forward."
}
const detective = {
    name: "Inspector Hale",
    description: "A 1920s London detective investigating a string of thefts.",
    instructions:
        "Narrate in third person past tense. Keep clues fair. Let the user act as Hale's partner."
}
const chef = {
    name: "Chef Ottavia",
    description: "A warm Italian home cook who helps with recipes and meal planning.",
    instructions:
        "Give practical cooking guidance with metric measurements. Ask about dietary needs."
}
const tutor = {
    name: "Socratic Tutor",
    description: "A patient tutor who guides students with questions instead of answers.",
    instructions: "Never give the final answer outright. Ask one guiding question at a time."
}

export const titleCases: TitleCase[] = [
    // Real first messages that produced bad titles in the app
    {
        id: "real-p12-fans",
        category: "real",
        messages: [
            u(
                "Which is better between the P12, P12 Pro, and P12 Max fans from a price-performance perspective? Also, which would be best for a deshroud mod?"
            )
        ],
        expect: /deshroud|price|value/i,
        avoid: /P12 P12/i
    },

    // Short single questions
    {
        id: "sky-color",
        category: "short-question",
        messages: [u("why is the sky blue but sunsets are orange")],
        expect: /sky|sunset|color|colour/i
    },
    {
        id: "sleep",
        category: "short-question",
        messages: [u("how many hours of sleep do teenagers actually need")],
        expect: /sleep|teen/i
    },
    {
        id: "mortgage",
        category: "short-question",
        messages: [u("is a 15 year or 30 year mortgage better if rates are 6%")],
        expect: /mortgage/i
    },
    {
        id: "cast-iron",
        category: "short-question",
        messages: [u("can I put my cast iron pan in the dishwasher")],
        expect: /cast iron|pan|skillet/i
    },
    {
        id: "black-holes",
        category: "short-question",
        messages: [u("what happens if you fall into a black hole")],
        expect: /black hole/i
    },
    {
        id: "visa",
        category: "short-question",
        messages: [u("do I need a visa to visit Japan with a UK passport for 2 weeks")],
        expect: /japan|visa/i
    },

    // Coding
    {
        id: "useeffect-loop",
        category: "coding",
        messages: [
            u(
                "My useEffect keeps firing forever:\n```tsx\nuseEffect(() => { setItems([...items, x]) }, [items])\n```\nhow do I fix this"
            ),
            a(
                "The effect updates `items`, which is in its own dependency array, so every render triggers another update. Use a functional update and drop `items` from the deps."
            )
        ],
        expect: /useeffect|react|loop/i
    },
    {
        id: "sql-join",
        category: "coding",
        messages: [
            u(
                "I need every customer with their latest order date, including customers with no orders. Postgres."
            ),
            a(
                "Use a LEFT JOIN with a grouped subquery: SELECT c.id, MAX(o.created_at) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id;"
            )
        ],
        expect: /sql|postgres|join|order|customer/i
    },
    {
        id: "python-traceback",
        category: "coding",
        messages: [
            u(
                'getting this\n```\nTraceback (most recent call last):\n  File "main.py", line 12, in <module>\n    data = json.load(f)\njson.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)\n```'
            )
        ],
        expect: /json|python|decode/i
    },
    {
        id: "rust-borrow",
        category: "coding",
        messages: [
            u(
                "why does rust say cannot borrow `self.items` as mutable because it is also borrowed as immutable when I loop and push"
            )
        ],
        expect: /rust|borrow/i
    },
    {
        id: "git-undo",
        category: "coding",
        messages: [
            u("I committed to main by accident and already pushed, how do I move it to a branch"),
            a(
                "Create a branch at the current commit, reset main back one commit, then force-push main with --force-with-lease if no one else has pulled."
            )
        ],
        expect: /git|commit|branch/i
    },
    {
        id: "css-center",
        category: "coding",
        messages: [u("cleanest way to center a div both ways in 2026")],
        expect: /center|centre|css|div/i
    },
    {
        id: "regex-email",
        category: "coding",
        messages: [
            u("write me a regex that validates emails but allows plus addressing"),
            a("Here is a pragmatic pattern: ^[^\\s@+]+(\\+[^\\s@]+)?@[^\\s@]+\\.[^\\s@]+$")
        ],
        expect: /regex|email/i
    },

    // Low-signal openers
    {
        id: "hey",
        category: "low-signal",
        messages: [u("hey"), a("Hey! What can I help you with today?")]
    },
    {
        id: "test",
        category: "low-signal",
        messages: [u("test")]
    },
    {
        id: "thanks",
        category: "low-signal",
        messages: [u("ok thanks"), a("You're welcome! Anything else?")]
    },
    {
        id: "help-me",
        category: "low-signal",
        messages: [u("can you help me with something"), a("Of course. What do you need?")]
    },

    // Topic shifts: the title should follow the newer topic
    {
        id: "lisbon-to-raise",
        category: "topic-shift",
        messages: [
            u("Can you help me plan a 5 day trip to Lisbon in March?"),
            a("Sure! Day 1: Alfama and the castle..."),
            u("Thanks. Unrelated, but how do I negotiate a raise?"),
            a("Start by benchmarking your market rate and listing recent wins..."),
            u("What if my manager says the budget is frozen?"),
            a(
                "Ask for a timeline to revisit, or negotiate non-salary items like title or training budget."
            )
        ],
        expect: /raise|salary|negotiat|pay/i,
        avoid: /lisbon/i
    },
    {
        id: "recipe-to-taxes",
        category: "topic-shift",
        messages: [
            u("what's a good vegetarian lasagna recipe"),
            a("Layer ricotta, spinach, and roasted zucchini with a tomato sauce..."),
            u("ok different question, can I deduct my home office on US taxes as a W-2 employee"),
            a("Generally no. The home office deduction was suspended for W-2 employees..."),
            u("what about if I also freelance on the side"),
            a("Then you can deduct the portion used exclusively for your freelance business...")
        ],
        expect: /tax|deduct|home office|freelanc/i,
        avoid: /lasagna/i
    },
    {
        id: "dog-to-laptop",
        category: "topic-shift",
        messages: [
            u("my dog keeps barking at night"),
            a("Try more evening exercise and a consistent wind-down routine..."),
            u("anyway, which laptop should I get for video editing under $1500"),
            a("Look for at least 32GB RAM and a strong GPU. Good options include..."),
            u("is the M5 MacBook Air enough or do I need the Pro"),
            a("For 4K timelines with effects, the Pro's sustained cooling matters...")
        ],
        expect: /laptop|macbook|video|editing/i,
        avoid: /dog|bark/i
    },
    {
        id: "same-topic-deepens",
        category: "topic-shift",
        messages: [
            u("how do I start running"),
            a("Begin with run-walk intervals three times a week..."),
            u("my knees hurt after week 2"),
            a("That's common. Check your shoes and reduce stride length..."),
            u("could it be IT band syndrome"),
            a("Pain on the outside of the knee could be ITBS...")
        ],
        expect: /run|knee|it band|itbs/i
    },
    {
        id: "resume-to-interview",
        category: "topic-shift",
        messages: [
            u("can you review my resume summary for a product manager role"),
            a("Tighten the first line and lead with a measurable outcome..."),
            u("thanks, I got the interview. how should I answer 'tell me about a failure'"),
            a("Pick a real failure, own your part, and focus on what changed afterwards..."),
            u("what about prioritization questions"),
            a("Use a framework like RICE and walk through a concrete example...")
        ],
        expect: /interview|product manager|pm\b/i
    },

    // Non-English: the title should stay in the user's language
    {
        id: "spanish-tenses",
        category: "non-english",
        messages: [u("¿Cuál es la diferencia entre el pretérito perfecto y el indefinido?")],
        expect: /pretérito|indefinido|diferencia/i
    },
    {
        id: "french-bread",
        category: "non-english",
        messages: [
            u("Pourquoi mon pain au levain ne lève pas assez ?"),
            a("Votre levain manque peut-être de vigueur. Nourrissez-le deux fois par jour...")
        ],
        expect: /pain|levain|lève/i
    },
    {
        id: "german-rent",
        category: "non-english",
        messages: [u("Darf mein Vermieter die Miete in Berlin einfach um 20 % erhöhen?")],
        expect: /miet|vermieter|berlin/i
    },
    {
        id: "japanese-keigo",
        category: "non-english",
        messages: [u("ビジネスメールで「了解しました」は失礼ですか？")],
        expect: /[぀-ヿ一-龯]/
    },
    {
        id: "portuguese-code",
        category: "non-english",
        messages: [
            u("Como faço para ler um arquivo CSV grande em Python sem estourar a memória?"),
            a("Use pandas.read_csv com chunksize, ou o módulo csv linha por linha...")
        ],
        expect: /csv|arquivo|python|memória/i
    },

    // Non-Latin scripts, each with its own rendering and tokenization quirks
    {
        id: "zh-hans-cat",
        category: "non-latin",
        messages: [u("为什么我的猫半夜总是在家里跑来跑去？")],
        expect: /猫/
    },
    {
        id: "zh-hant-train",
        category: "non-latin",
        messages: [u("請問台北到花蓮搭火車要多久？有推薦的車次嗎？")],
        expect: /台北|花蓮|火車/
    },
    {
        id: "ko-jeonse",
        category: "non-latin",
        messages: [u("전세 계약할 때 확정일자는 꼭 받아야 하나요?")],
        expect: /전세|확정일자/
    },
    {
        id: "ja-brackets-yoroshiku",
        category: "non-latin",
        messages: [u("「よろしくお願いします」を英語でどう言えばいいですか？")],
        expect: /よろしく/
    },
    {
        id: "ja-shinkansen",
        category: "non-latin",
        messages: [u("東京から京都まで新幹線で行くのと夜行バスで行くのはどちらが安いですか？")],
        expect: /新幹線|夜行バス|京都/
    },
    {
        id: "ar-zakat",
        category: "non-latin",
        messages: [u("ما الفرق بين الزكاة والصدقة؟")],
        expect: /الزكاة|الصدقة/
    },
    {
        id: "ar-js-error",
        category: "non-latin",
        messages: [u("كيف أصلح خطأ undefined is not a function في جافاسكربت؟")],
        expect: /جافاسكربت|javascript|undefined/i
    },
    {
        id: "ur-freelance-tax",
        category: "non-latin",
        messages: [u("پاکستان میں فری لانسنگ سے کمائی پر ٹیکس کیسے دیا جاتا ہے؟")],
        expect: /ٹیکس|فری لانس/
    },
    {
        id: "dv-keyboard",
        category: "non-latin",
        messages: [u("ދިވެހި ބަހުން ލިޔުމަށް ކީބޯޑް ސެޓްކުރާނީ ކިހިނެއް؟")],
        expect: /ދިވެހި|ކީބޯޑް/
    },
    {
        id: "sa-karma-yoga",
        category: "non-latin",
        messages: [u("भगवद्गीतायां कर्मयोगस्य अर्थः कः?")],
        expect: /कर्मयोग|गीता/
    },
    {
        id: "th-mango-rice",
        category: "non-latin",
        messages: [u("ทำไมข้าวเหนียวมะม่วงถึงต้องใช้กะทิ")],
        expect: /ข้าวเหนียว|มะม่วง|กะทิ/
    },

    // Hinglish: Hindi in Latin letters, usually mixed with English.
    {
        id: "hinglish-laptop",
        category: "romanized",
        messages: [
            u("bhai mera laptop bahut garam ho raha hai aur fan ki awaaz bhi tez hai, kya karu?")
        ],
        expect: /laptop|garam|fan|overheat|heat/i,
        userSpellings: /garam|awaaz|bahut/i,
        allowScripts: ["devanagari"]
    },
    {
        id: "hinglish-react-build",
        category: "romanized",
        messages: [
            u(
                "yaar mera react app build ke time pe crash ho raha hai, 'heap out of memory' bol raha hai, kaise fix karu?"
            )
        ],
        expect: /react|build|heap|memory|crash/i,
        userSpellings: /kaise|karu|raha|yaar/i,
        allowScripts: ["devanagari"]
    },
    {
        id: "hinglish-interview",
        category: "romanized",
        messages: [
            u(
                "mujhe interview ke liye ek strong introduction chahiye, product manager role ke liye"
            )
        ],
        expect: /interview|introduction|product manager|pm\b/i,
        userSpellings: /mujhe|chahiye|ke liye/i,
        allowScripts: ["devanagari"]
    },
    {
        id: "hinglish-sleep",
        category: "romanized",
        messages: [u("aaj kal neend hi nahi aati raat ko, koi gharelu nuskha batao")],
        expect: /neend|sleep|insomnia|nuskha|remed/i,
        userSpellings: /neend|nuskha|gharelu|raat/i,
        allowScripts: ["devanagari"]
    },
    {
        id: "hinglish-paneer",
        category: "romanized",
        messages: [u("ghar pe soft paneer kaise banate hain bina machine ke?")],
        expect: /paneer/i,
        userSpellings: /kaise|banate|ghar|bina/i,
        allowScripts: ["devanagari"]
    },

    // Arabizi: Arabic in Latin letters with digits for sounds Latin lacks (3 = ع, 7 = ح, 2 = ء, 5 = خ).
    // Arabizi, Arabic script, and English titles are all defensible, so the form is tallied, not scored.
    {
        id: "arabizi-zakat",
        category: "romanized",
        messages: [u("shu el far2 bein el zakat wel sada2a?")],
        expect: /zakat|sada|زكاة|صدقة|charity|alms/i,
        userSpellings: /far2|sada2a/i,
        allowScripts: ["arabic"]
    },
    {
        id: "arabizi-instagram",
        category: "romanized",
        messages: [u("ezay a3mel account gedid 3ala instagram law el adim et2afal?")],
        expect: /instagram|انستغرام|انستجرام|إنستغرام|account|حساب/i,
        userSpellings: /ezay|a3mel|gedid|3ala|et2afal/i,
        allowScripts: ["arabic"]
    },
    {
        id: "arabizi-laptop",
        category: "romanized",
        messages: [u("7abibi el laptop 3ndi sa5en ktir w byitfi la7alo, shu el 7al?")],
        expect: /laptop|لابتوب|حرار|overheat|sa5en|shut|يطفي|بيطفي/i,
        userSpellings: /sa5en|byitfi|la7alo|7al\b/i,
        allowScripts: ["arabic"]
    },

    // Persona roleplay: title the scene, not the persona
    {
        id: "mara-fog",
        category: "persona-roleplay",
        persona: mara,
        messages: [
            a(
                "*Mara leans on the rail as the harbor bells ring.* You're late. The Customs cutter's already sniffing around pier nine."
            ),
            u(
                "*I toss her the sealed crate key.* Then we sail now. Can we lose them in the fog banks?"
            ),
            a("*She grins and spins the wheel hard to port.* Hold onto something, landlubber.")
        ],
        expect: /fog|escape|customs|cutter|harbor|harbour|flee/i,
        avoid: GENERIC
    },
    {
        id: "mara-short-replies",
        category: "persona-roleplay",
        persona: mara,
        messages: [
            a(
                "*The tavern goes quiet as a stranger in a silver mask sets a map on Mara's table.* Says here there's a wreck off Gull Point full of imperial gold."
            ),
            u("*nods*"),
            a("*Mara traces the reef line.* Nobody comes back from Gull Point. Still want in?"),
            u("yes"),
            a(
                "*Mara slams the map flat and whistles for the crew.* Then we sail at dawn. Bring rope, and pray the reef's asleep."
            )
        ],
        expect: /wreck|gold|gull|map|treasure|mask/i,
        avoid: GENERIC
    },
    {
        id: "hale-clue",
        category: "persona-roleplay",
        persona: detective,
        messages: [
            a(
                "Hale knelt by the shattered display case. The Delacroix emerald was gone, but a single muddy bootprint pointed toward the servants' stair."
            ),
            u("I check the bootprint for anything unusual"),
            a(
                "Pressed into the mud were flecks of red clay, the kind found only on the Thames embankment works."
            )
        ],
        expect: /emerald|bootprint|clue|theft|delacroix|clay/i,
        avoid: GENERIC
    },
    {
        id: "hale-scene-moves-on",
        category: "persona-roleplay",
        persona: detective,
        messages: [
            a("Hale studied the pawnbroker's ledger in the dim shop."),
            u("We note the name in the ledger and leave"),
            a("Outside, the fog thickened as they hailed a cab."),
            u("We go to the docks to find the man from the ledger"),
            a(
                "At the docks a dockhand pointed them toward a warehouse. A lantern flickered inside, and someone was burning papers."
            ),
            u("I kick the door open"),
            a(
                "The door splintered inward. The man from the ledger spun from the brazier, half-burnt papers scattering as he bolted for the river hatch."
            )
        ],
        expect: /dock|warehouse|raid|burning|papers/i,
        avoid: GENERIC
    },
    {
        id: "mara-romance",
        category: "persona-roleplay",
        persona: mara,
        messages: [
            a(
                "*The storm has passed. Mara sits alone on the deck, sharing a bottle under the stars.*"
            ),
            u("*I sit beside her* You never told me why you left the navy."),
            a(
                "*She's quiet a long moment.* They ordered me to sink a ship full of refugees. I sank my commission instead."
            )
        ],
        expect: /navy|past|confession|stars|deck|storm|refugee/i,
        avoid: GENERIC
    },
    // New persona chats: the persona's opening plus the user's first reply.
    {
        id: "mara-opening-reply",
        category: "persona-roleplay",
        persona: mara,
        messages: [
            a(
                "*Rain hammers the shutters of the Drowned Lantern. Mara doesn't look up from her cards.* If you're here for work, sit. If you're here for trouble, the door's behind you."
            ),
            u(
                "*I slide a pouch of coins across the table* I need passage to the Ember Isles. No questions asked."
            )
        ],
        expect: /ember isles|passage|voyage|smuggl|bargain|deal/i,
        avoid: GENERIC
    },
    {
        id: "mara-opening-nod",
        category: "persona-roleplay",
        persona: mara,
        messages: [
            a(
                "*A stranger in a silver mask sets a map on Mara's table.* Says here there's a wreck off Gull Point full of imperial gold. You in or out?"
            ),
            u("*nods*")
        ],
        expect: /wreck|gold|gull|map|treasure|mask/i,
        avoid: GENERIC
    },
    {
        id: "hale-opening-reply",
        category: "persona-roleplay",
        persona: detective,
        messages: [
            a(
                "Lady Ashworth's pearls vanished between the soup and the fish course. Eleven guests, four servants, and not one of them left the house. Hale turned to his partner. 'Where shall we begin?'"
            ),
            u("Let's question the butler first.")
        ],
        expect: /pearl|ashworth|butler|dinner|theft|interrogat/i,
        avoid: GENERIC
    },
    {
        id: "mara-user-led",
        category: "persona-roleplay",
        persona: mara,
        messages: [
            u(
                "*I stumble into the tavern, soaked and bleeding* Captain, they took my sister. I need your ship."
            )
        ],
        expect: /sister|rescue|ship|tavern|plea|kidnap/i,
        avoid: GENERIC
    },

    // Persona assistants: title the task, not the persona
    {
        id: "chef-meal-plan",
        category: "persona-assistant",
        persona: chef,
        messages: [
            u("I need a week of dinners for two, one of us is lactose intolerant"),
            a("Wonderful! Let's start with a lemon chicken with roasted potatoes on Monday...")
        ],
        expect: /meal|dinner|lactose|week/i,
        avoid: /ottavia|chef/i
    },
    {
        id: "chef-risotto-fix",
        category: "persona-assistant",
        persona: chef,
        messages: [u("my risotto always comes out gluey, what am I doing wrong")],
        expect: /risotto/i,
        avoid: /ottavia/i
    },
    {
        id: "tutor-derivatives",
        category: "persona-assistant",
        persona: tutor,
        messages: [
            u("what's the derivative of x^2 sin(x)"),
            a("Good question. What rule do we use when two functions are multiplied together?"),
            u("the product rule?"),
            a("Exactly. So if f = x² and g = sin(x), what are f′ and g′?")
        ],
        expect: /derivative|product rule|calculus/i,
        avoid: /socratic|tutor/i
    },
    {
        id: "chef-pantry",
        category: "persona-assistant",
        persona: chef,
        messages: [u("what can I make tonight with chickpeas, spinach and half a lemon")],
        expect: /chickpea|spinach|lemon|dinner|recipe|meal/i,
        avoid: /ottavia/i
    },
    {
        id: "tutor-recursion",
        category: "persona-assistant",
        persona: tutor,
        messages: [u("I don't get recursion at all, can you help")],
        expect: /recursi/i,
        avoid: /socratic|tutor/i
    },
    // Persona chats outside English, to check whether the persona prompt needs the language rules.
    {
        id: "mara-hinglish-sister",
        category: "persona-roleplay",
        persona: mara,
        messages: [
            u(
                "*main bheegta hua tavern mein ghusta hoon* Captain, unhone meri behen ko utha liya, mujhe tumhara jahaz chahiye"
            )
        ],
        expect: /behen|jahaz|sister|rescue|ship/i,
        avoid: /\b(chat|conversation|roleplay)\b/i,
        userSpellings: /behen|jahaz|bheeg/i
    },
    {
        id: "chef-hinglish-dough",
        category: "persona-assistant",
        persona: chef,
        messages: [u("mujhe ghar pe pizza dough banana hai bina yeast ke, kaise karu?")],
        expect: /pizza|dough/i,
        avoid: /ottavia/i,
        userSpellings: /bina|banana|ghar|kaise/i
    },
    {
        id: "tutor-japanese-recursion",
        category: "persona-assistant",
        persona: tutor,
        messages: [u("再帰関数がよくわかりません。教えてください。")],
        expect: /再帰/,
        avoid: /socratic|tutor/i
    },

    // Attachments
    {
        id: "pdf-summary",
        category: "attachments",
        messages: [
            u(
                `${file("Q3_board_report.pdf", "Revenue grew 14% while churn rose to 4.1%...")}\nsummarize the key risks in this`
            )
        ],
        expect: /q3|board|report|risk/i
    },
    {
        id: "image-only",
        category: "attachments",
        messages: [
            {
                role: "user",
                content: [
                    { type: "image", image: new URL("https://example.com/plant.jpg") },
                    { type: "text", text: "what's wrong with my plant" }
                ]
            },
            a("The yellowing lower leaves and soggy soil suggest overwatering...")
        ],
        expect: /plant|leaves|overwater/i
    },
    {
        id: "csv-file",
        category: "attachments",
        messages: [
            u(
                `${file("sales_2026.csv", "region,month,revenue\nEMEA,Jan,120000\nAPAC,Jan,98000")}\nwhich region is declining fastest`
            ),
            a("APAC revenue fell 18% from January to June, the steepest decline...")
        ],
        expect: /sales|region|declin|revenue/i
    },
    {
        id: "contract-review",
        category: "attachments",
        messages: [
            u(
                `${file("lease_agreement.docx", "The tenant shall be responsible for all repairs...")}\nis there anything unfair in this lease`
            )
        ],
        expect: /lease|contract|tenant|rental/i
    },

    // Long multi-turn threads
    {
        id: "wedding-speech",
        category: "long-thread",
        messages: [
            u("I'm the best man at my brother's wedding next month and I'm terrified"),
            a("Totally normal. Let's build it in three parts: an opener, a story, and a toast."),
            u("He met his fiancée at a climbing gym, that's a good story right"),
            a(
                "Perfect. You could frame it around him falling for her before he fell off the wall."
            ),
            u("haha ok. how long should it be"),
            a("Aim for three to five minutes, roughly 500 to 700 words."),
            u("and should I mention our dad who passed away"),
            a("A brief, warm mention can be lovely. Keep it short and return to the couple.")
        ],
        expect: /speech|best man|wedding|toast/i
    },
    {
        id: "startup-pricing",
        category: "long-thread",
        messages: [
            u("We're launching a B2B analytics SaaS. How should we price it?"),
            a("Consider value-based tiers tied to usage, like seats or tracked events."),
            u("Our competitors charge per seat"),
            a(
                "Usage-based pricing can differentiate you if customers resent paying for idle seats."
            ),
            u("How do we handle enterprise customers"),
            a("Offer a custom tier with SSO, SLAs, and annual contracts."),
            u("Should we have a free tier at all"),
            a("A limited free tier helps adoption if your activation path is self-serve.")
        ],
        expect: /pric|saas|tier/i
    },
    {
        id: "kitchen-renovation",
        category: "long-thread",
        messages: [
            u("planning a kitchen renovation, budget is about $40k"),
            a("Typical splits: cabinets 30%, labor 20%, appliances 15%..."),
            u("quartz or granite countertops"),
            a("Quartz is lower maintenance, granite has more natural variation..."),
            u("what about the order of work, do floors go before cabinets"),
            a("Usually flooring goes in first under the cabinets, unless it's floating floor..."),
            u("ok and how long should all this take"),
            a("Plan for 6 to 10 weeks including lead times on cabinets.")
        ],
        expect: /kitchen|renovat|remodel/i
    },
    {
        id: "novel-plotting",
        category: "long-thread",
        messages: [
            u(
                "I'm writing a sci-fi novel about a generation ship where the crew forgot it's a ship"
            ),
            a("Great premise. Who discovers the truth first?"),
            u("a maintenance worker who finds a door that shouldn't exist"),
            a("That gives you a strong inciting incident. What's behind the door?"),
            u("the bridge, untouched for 200 years"),
            a("Then the midpoint could be when she realizes the ship is off course."),
            u("how do I keep the middle act from sagging"),
            a("Give her a rival who benefits from the lie, and escalate the cost of exposure.")
        ],
        expect: /generation ship|novel|sci-fi|plot|ship/i
    },

    // Creative writing
    {
        id: "haiku-request",
        category: "creative",
        messages: [u("write a haiku about autumn rain on a tin roof")],
        expect: /haiku|autumn|rain/i
    },
    {
        id: "bedtime-story",
        category: "creative",
        messages: [
            u("tell my 5 year old a bedtime story about a dragon who's scared of the dark"),
            a(
                "Once upon a time, in a cave at the edge of the Whispering Woods, lived a small dragon named Ember..."
            )
        ],
        expect: /dragon|bedtime|dark/i
    },
    {
        id: "product-copy",
        category: "creative",
        messages: [
            u("write landing page copy for a reusable water bottle that tracks hydration"),
            a("Hydration, handled. Meet the bottle that knows when you need a sip...")
        ],
        expect: /bottle|hydration|landing|copy/i
    },

    // Math and reasoning
    {
        id: "probability",
        category: "math",
        level: "school",
        messages: [
            u("If I roll two dice, what's the probability the sum is at least 10?"),
            a("There are 6 favorable outcomes out of 36, so the probability is 1/6.")
        ],
        expect: /dice|probab|roll/i
    },
    {
        id: "compound-interest",
        category: "math",
        level: "school",
        messages: [u("how much will $500/month become in 25 years at 7% compounded monthly")],
        expect: /compound|interest|invest|saving|growth/i
    },

    {
        id: "tip-percent",
        category: "math",
        level: "basic",
        messages: [u("how do I work out a 15% tip on $86.40 in my head")],
        expect: /tip|percent|%|mental/i
    },
    {
        id: "fractions",
        category: "math",
        level: "basic",
        messages: [
            u("is 3/8 bigger than 2/5"),
            a("No. 3/8 is 0.375 and 2/5 is 0.4, so 2/5 is bigger.")
        ],
        expect: /fraction|3\/8|2\/5|compar/i
    },
    {
        id: "quadratic",
        category: "math",
        level: "school",
        messages: [
            u("solve 2x^2 - 7x + 3 = 0 by completing the square, my teacher wants all the steps")
        ],
        expect: /quadratic|completing the square|equation/i
    },
    {
        id: "diagonalizable",
        category: "math",
        level: "undergrad",
        messages: [
            u("Is the matrix [[2,1],[0,2]] diagonalizable? I found the eigenvalue 2 twice"),
            a(
                "No. The eigenvalue 2 has algebraic multiplicity 2 but its eigenspace is only one-dimensional, so it's a Jordan block."
            )
        ],
        expect: /diagonaliz|eigen|matrix|jordan/i
    },
    {
        id: "epsilon-delta",
        category: "math",
        level: "undergrad",
        messages: [u("prove using epsilon-delta that the limit of x^2 as x approaches 2 is 4")],
        expect: /epsilon|delta|limit|proof/i
    },
    {
        id: "vitali-set",
        category: "math",
        level: "grad",
        messages: [
            u(
                "Why isn't every subset of R Lebesgue measurable? Walk me through the Vitali construction and where choice is used"
            ),
            a(
                "Partition [0,1] into cosets of Q, use the axiom of choice to pick one representative from each, then show countable translates would force measure 0 = 1..."
            )
        ],
        expect: /vitali|lebesgue|measur|choice/i
    },
    {
        id: "galois-group",
        category: "math",
        level: "grad",
        messages: [u("show the Galois group of x^4 - 2 over Q is the dihedral group of order 8")],
        expect: /galois|dihedral|x\^4|polynomial/i
    },
    {
        id: "eichler-shimura",
        category: "math",
        level: "research",
        messages: [
            u(
                "For my thesis I need the étale cohomology of a Shimura curve with Iwahori level at p. Does the Eichler–Shimura congruence relation still pin down the Frobenius trace when the level isn't prime to p?"
            ),
            a(
                "Not directly. At Iwahori level the integral model has semistable reduction, so you'd use the Rapoport–Zink weight spectral sequence and track the monodromy operator..."
            )
        ],
        expect: /eichler|shimura|frobenius|étale|etale|cohomolog|iwahori/i
    },
    {
        id: "nls-blowup",
        category: "math",
        level: "research",
        messages: [
            u(
                "Is there a known counterexample to global regularity for the defocusing supercritical NLS in dimension 5? I'm trying to adapt Tao's averaged Navier–Stokes blowup construction"
            )
        ],
        expect: /nls|schr[öo]dinger|blow ?up|regularity|navier|supercritical/i
    },

    // Science difficulty ladder
    {
        id: "ice-floats",
        category: "science",
        level: "basic",
        messages: [u("why does ice float on water")],
        expect: /ice|float|density/i
    },
    {
        id: "leap-years",
        category: "science",
        level: "basic",
        messages: [u("why do we have leap years")],
        expect: /leap/i
    },
    {
        id: "balance-equation",
        category: "science",
        level: "school",
        messages: [
            u("balance this for my chem homework: Fe + O2 -> Fe2O3"),
            a(
                "4Fe + 3O₂ → 2Fe₂O₃. Balance oxygen first with the lowest common multiple of 2 and 3, then fix iron."
            )
        ],
        expect: /balanc|equation|iron|\bfe\b|rust|oxid/i
    },
    {
        id: "photosynthesis",
        category: "science",
        level: "school",
        messages: [
            u(
                "explain the light dependent vs light independent reactions of photosynthesis for my bio exam"
            )
        ],
        expect: /photosynth|light|calvin/i
    },
    {
        id: "hydrogen-degeneracy",
        category: "science",
        level: "undergrad",
        messages: [
            u("why do the hydrogen atom energy levels only depend on n and not l"),
            a(
                "It's an accidental degeneracy from the extra SO(4) symmetry of the Coulomb potential, tied to the conserved Laplace–Runge–Lenz vector."
            )
        ],
        expect: /hydrogen|degenera|energy level|quantum|runge|lenz/i
    },
    {
        id: "sn1-e2",
        category: "science",
        level: "undergrad",
        messages: [
            u(
                "tertiary alkyl bromide in ethanol with heat, SN1 or E1 or E2? we keep getting different answers in study group"
            )
        ],
        expect: /sn1|sn2|e1|e2|elimination|substitution|alkyl|reaction/i
    },
    {
        id: "wilson-fisher",
        category: "science",
        level: "grad",
        messages: [
            u(
                "Why does the epsilon expansion around the Wilson–Fisher fixed point give such good critical exponents at epsilon = 1 when it's only asymptotic?"
            ),
            a(
                "Partly luck and partly Borel resummation. The series is asymptotic, but resummed with the known large-order behavior it converges well for the 3D Ising class..."
            )
        ],
        expect: /epsilon|wilson|fisher|critical|renormaliz|exponent/i
    },
    {
        id: "alphafold-idr",
        category: "science",
        level: "grad",
        messages: [
            u(
                "why does AlphaFold give low pLDDT for intrinsically disordered regions, and is that low confidence actually informative?"
            )
        ],
        expect: /alphafold|disorder|plddt|protein/i
    },
    {
        id: "cryo-em-orientation",
        category: "science",
        level: "research",
        messages: [
            u(
                "Our cryo-EM map of a GPCR–arrestin complex has anisotropic resolution from preferred orientation. Is tilted collection or switching to graphene oxide grids the better bet?"
            ),
            a(
                "Try a 30–40° tilted collection first since it needs no new sample prep, then assess with 3DFSC. Graphene oxide helps if particles are sticking to the air-water interface..."
            )
        ],
        expect: /cryo|gpcr|arrestin|orientation|anisotrop|grid/i
    },
    {
        id: "dft-mott",
        category: "science",
        level: "research",
        messages: [
            u(
                "DFT+U gives us the wrong gap ordering versus ARPES for our Mott insulator. Is it worth moving to DMFT, or should we try hybrid functionals first?"
            )
        ],
        expect: /dft|dmft|mott|hybrid|gap|arpes/i
    },
    {
        id: "jwst-nitrogen",
        category: "science",
        level: "research",
        messages: [
            u(
                "Our JWST NIRSpec spectrum of a z≈10 galaxy shows strong N IV] 1486 emission. Is that better evidence for supermassive stars or a nitrogen-enriched AGN?"
            ),
            a(
                "It's hard to separate them on N IV] alone. Look for He II 1640 strength and line widths; broad components or high-ionization lines like N V would favor an AGN..."
            )
        ],
        expect: /jwst|nitrogen|galax|n iv|emission|supermassive|agn/i
    },

    // Sensitive personal topics
    {
        id: "chest-pain",
        category: "sensitive",
        messages: [
            u("I've had a tight chest and left arm tingling for an hour, is this anxiety"),
            a(
                "These can be signs of a heart attack. Please call emergency services now rather than waiting."
            )
        ],
        expect: /chest|arm|heart|symptom/i
    },
    {
        id: "breakup",
        category: "sensitive",
        messages: [
            u("my partner of 6 years just broke up with me and I can't stop crying"),
            a("I'm really sorry. That's a huge loss, and crying is a normal response...")
        ],
        expect: /breakup|break up|heartbreak|relationship|coping/i
    }
]
