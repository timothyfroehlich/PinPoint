/**
 * The id of the element the app shell renders for a List View's phone pager
 * (list-views §7.8): a direct child of the scroller (`#main-content`),
 * outside the content wrapper. That wrapper is a size container, and WebKit
 * before 18.2 still gave size containers layout containment, which made the
 * wrapper the containing block of a fixed bar inside it. Kept out of the
 * client pager module so the server layout reads the string itself.
 */
export const LIST_PAGER_SLOT_ID = "list-pager-slot";
