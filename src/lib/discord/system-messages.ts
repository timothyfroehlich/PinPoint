export function formatDiscordWelcomeMessage(siteUrl: string): string {
  return [
    "**Discord notifications are on**",
    "You’ll receive assignments, mentions, and activity on machines and issues you own or watch. Notifications about your own actions are muted by default.",
    "",
    `[Review notification settings](${siteUrl}/settings/notifications)`,
  ].join("\n");
}

export function formatDiscordImprovementNotice(siteUrl: string): string {
  return [
    "**Discord notifications have been improved**",
    "Messages now include clearer context and links. Your notification choices haven’t changed.",
    "",
    `[Review or disable Discord notifications](${siteUrl}/settings/notifications)`,
  ].join("\n");
}
