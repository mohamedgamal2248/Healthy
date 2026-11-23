import { redirect } from "next/navigation";

/** "My library" now lives inside Healthy AI as the "My results" tab. */
export default function LibraryPage() { redirect("/chef?tab=mine"); }
