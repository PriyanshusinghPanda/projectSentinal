import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
loadSerif("normal", { weights: ["400"], subsets: ["latin"] });
loadSerif("italic", { weights: ["400"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "600"], subsets: ["latin"] });
