import { runDiscordImprovementNoticeRollout } from "~/lib/discord/improvement-rollout";

const send = process.argv.slice(2).includes("--send");
const result = await runDiscordImprovementNoticeRollout({ send });

console.log(
  JSON.stringify(
    {
      mode: send ? "send" : "dry-run",
      ...result,
    },
    null,
    2
  )
);

if (result.failed > 0) process.exitCode = 1;
