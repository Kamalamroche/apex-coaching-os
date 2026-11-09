/* Languages. The English text is the key: `translate("es", "Today")` → "Hoy". Anything not in a
   language's list stays in English, so screens can move over a few strings at a time. Add a language
   by adding it to LANGS and giving it a dictionary below; i18n.test.ts checks every dictionary has
   the same keys and keeps each {placeholder}. */

export type Lang = "en" | "es" | "fr";

export const LANGS: { id: Lang; name: string; english: string }[] = [
  { id: "en", name: "English", english: "English" },
  { id: "es", name: "Español", english: "Spanish" },
  { id: "fr", name: "Français", english: "French" },
];

export const normaliseLang = (v: unknown): Lang => (LANGS.some((l) => l.id === v) ? (v as Lang) : "en");

/** The first supported language in the browser's list, e.g. ["es-MX", "en"] → "es". */
export function detectLang(preferred: readonly string[]): Lang {
  for (const p of preferred) {
    const base = p.toLowerCase().split("-")[0];
    const hit = LANGS.find((l) => l.id === base);
    if (hit) return hit.id;
  }
  return "en";
}

type Dict = Record<string, string>;

const es: Dict = {
  // App frame
  "Today": "Hoy",
  "Train": "Entrenar",
  "Progress": "Progreso",
  "Messages": "Mensajes",
  "More": "Más",
  "Brief": "Resumen",
  "Clients": "Clientes",
  "Builder": "Programas",
  "Nutrition": "Nutrición",
  "Business": "Negocio",
  "Account": "Cuenta",
  "Sign out": "Cerrar sesión",
  "Back": "Atrás",
  "← Switch": "← Cambiar",
  "Auto": "Auto",
  "Dark": "Oscuro",
  "Light": "Claro",
  // More
  "Everything": "Todo",
  "else": "lo demás",
  "Habits": "Hábitos",
  "About you": "Sobre ti",
  "Form checks": "Revisión de técnica",
  "Community": "Comunidad",
  "Goals": "Objetivos",
  "Challenges": "Retos",
  "Resources": "Recursos",
  "Book a session": "Reservar una sesión",
  "Connected apps": "Apps conectadas",
  "Strava, watch files, and what's coming next": "Strava, archivos del reloj y lo que viene",
  "Privacy and account": "Privacidad y cuenta",
  "Your agreements, download your data, delete your account": "Tus consentimientos, descarga tus datos, elimina tu cuenta",
  "Settings": "Ajustes",
  "Units and language": "Unidades e idioma",
  // Settings
  "Units": "Unidades",
  "Language": "Idioma",
  "Weight": "Peso",
  "Body measurements": "Medidas corporales",
  "Distance": "Distancia",
  "Metric": "Métrico",
  "US / imperial": "EE. UU. / imperial",
  "Kilograms (kg)": "Kilogramos (kg)",
  "Pounds (lb)": "Libras (lb)",
  "Centimetres (cm)": "Centímetros (cm)",
  "Feet and inches": "Pies y pulgadas",
  "Kilometres (km)": "Kilómetros (km)",
  "Miles (mi)": "Millas (mi)",
  "Saved to your account": "Guardado en tu cuenta",
  "Saved on this device": "Guardado en este dispositivo",
  "Everything is stored in kg and cm, so you can switch any time without losing anything.": "Todo se guarda en kg y cm, así que puedes cambiar cuando quieras sin perder nada.",
  "More of the app is being translated. Anything not yet translated shows in English.": "Estamos traduciendo más partes de la app. Lo que aún no está traducido aparece en inglés.",
  "Example: {weight} · {height} · {distance}": "Ejemplo: {weight} · {height} · {distance}",
  // Today and progress
  "Check in": "Registro semanal",
  "Start workout": "Empezar entreno",
  "Rest day": "Día de descanso",
  "Weight, {unit}": "Peso, {unit}",
  "Waist, {unit}": "Cintura, {unit}",
};

const fr: Dict = {
  "Today": "Aujourd'hui",
  "Train": "Entraînement",
  "Progress": "Progrès",
  "Messages": "Messages",
  "More": "Plus",
  "Brief": "Synthèse",
  "Clients": "Clients",
  "Builder": "Programmes",
  "Nutrition": "Nutrition",
  "Business": "Activité",
  "Account": "Compte",
  "Sign out": "Se déconnecter",
  "Back": "Retour",
  "← Switch": "← Changer",
  "Auto": "Auto",
  "Dark": "Sombre",
  "Light": "Clair",
  "Everything": "Tout",
  "else": "le reste",
  "Habits": "Habitudes",
  "About you": "À propos de vous",
  "Form checks": "Analyse technique",
  "Community": "Communauté",
  "Goals": "Objectifs",
  "Challenges": "Défis",
  "Resources": "Ressources",
  "Book a session": "Réserver une séance",
  "Connected apps": "Applis connectées",
  "Strava, watch files, and what's coming next": "Strava, fichiers de montre et nouveautés à venir",
  "Privacy and account": "Confidentialité et compte",
  "Your agreements, download your data, delete your account": "Vos accords, téléchargez vos données, supprimez votre compte",
  "Settings": "Réglages",
  "Units and language": "Unités et langue",
  "Units": "Unités",
  "Language": "Langue",
  "Weight": "Poids",
  "Body measurements": "Mensurations",
  "Distance": "Distance",
  "Metric": "Métrique",
  "US / imperial": "US / impérial",
  "Kilograms (kg)": "Kilogrammes (kg)",
  "Pounds (lb)": "Livres (lb)",
  "Centimetres (cm)": "Centimètres (cm)",
  "Feet and inches": "Pieds et pouces",
  "Kilometres (km)": "Kilomètres (km)",
  "Miles (mi)": "Miles (mi)",
  "Saved to your account": "Enregistré sur votre compte",
  "Saved on this device": "Enregistré sur cet appareil",
  "Everything is stored in kg and cm, so you can switch any time without losing anything.": "Tout est enregistré en kg et en cm : vous pouvez changer à tout moment sans rien perdre.",
  "More of the app is being translated. Anything not yet translated shows in English.": "La traduction de l'appli continue. Ce qui n'est pas encore traduit s'affiche en anglais.",
  "Example: {weight} · {height} · {distance}": "Exemple : {weight} · {height} · {distance}",
  "Check in": "Bilan",
  "Start workout": "Commencer la séance",
  "Rest day": "Jour de repos",
  "Weight, {unit}": "Poids, {unit}",
  "Waist, {unit}": "Tour de taille, {unit}",
};

export const DICTS: Record<Exclude<Lang, "en">, Dict> = { es, fr };

/** Fills {name} placeholders. */
const fill = (s: string, vars?: Record<string, string | number>): string =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  return fill(lang === "en" ? text : DICTS[lang][text] ?? text, vars);
}
