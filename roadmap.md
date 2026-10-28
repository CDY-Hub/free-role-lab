# Roadmap

## Matcher / livescore
- [x] /matcher-sida med dagens matcher, liveresultat och dagnavigering
- [x] Integrerat stöd för api-football.com (API-Sports v3) med fokus på Top 5 ligorna, liga cuperna, Champions League & Allsvenskan
- [x] Sortering efter prioriterade ligor (UCL, UEL, Premier League, LaLiga, Serie A, Allsvenskan m.fl.)
- [x] Stöd för football-data.org (FOOTBALL_DATA_TOKEN) + egen livescore-server (LIVESCORE_API_URL)
- [x] Förhandsvisning med snygg setup-guide vid saknad API-nyckel så sidan aldrig kraschar med röd text

## AI-Chatt
- [x] Stöd för Google Gemini (GEMINI_API_KEY), OpenAI (OPENAI_API_KEY) och Lovable AI Gateway (LOVABLE_API_KEY)
- [x] Strikt fotbolls-persona: enbart fotboll, taktik, spelare, transfers och scouting
- [x] Direktkoppling vid frågor om bilar/livsstil: rabblar upp fotbollsstjärnors bilsamlingar (Zlatan, Ronaldo, Haaland, Messi m.fl.) samt klubbars bilsponsorskap (Bayern/Audi, Real Madrid/BMW m.fl.)

## FIFA & UEFA
- [x] VM 2026 i USA, Kanada & Mexiko tillagt i FIFA-översikten och detaljsidan
- [x] Decennie- och säsongsväljare för Champions League & Europa League (71-72 till 79-80, 80-81 till 89-90, 90-91 till 99-00 osv)
- [x] Komplett säsongsfakta och turneringsinformation per valt år via Wikipedia, stylat i sajtens tema
- [x] Växling mellan decennie/säsongsväljare och historiska finaler

## Sökning & Prestanda
- [x] Fixad seghet vid flikbyten på startsidan genom servercaching (in-memory TTL) och bibehållen DOM-montering
- [x] Borttagna söktips/förslag på startsidan
- [x] Maximerad spelarsökning via Transfermarkt API med flersidigt hämtande och visning av alla resultat
- [x] Utökad ligakatalog med svenska Ettan Norra/Södra, Superettan och internationella andradivisioner
