// Moved to ~/lib/auth/viewer (PP-az4d.9). This re-export keeps importers that
// open PRs own compiling; delete it once they import the new path.
export { getViewer, type Viewer } from "~/lib/auth/viewer";
