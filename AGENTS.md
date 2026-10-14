<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Transfermarkt calls go through server functions in src/lib/tm.functions.ts (API lacks CORS and rate-limits ~2 req/3s, so calls retry and pages fetch sequentially).
- Local sample data lives in src/lib/data.ts and is generated deterministically so URLs stay stable.
- AI chat streams via src/routes/api/chat.ts -> src/lib/ai/chat.server.ts; threads persist in localStorage (src/lib/threads.ts).
