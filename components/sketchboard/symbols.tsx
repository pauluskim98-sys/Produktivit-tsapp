import {
  Sun,
  Mountain,
  TreePalm,
  Plane,
  Cloud,
  CloudRain,
  Rainbow,
  Moon,
  Star,
  Trees,
  Waves,
  Flower2,
  Flame,
  Snowflake,
  Rocket,
  Sailboat,
  Bike,
  TrainFront,
  Car,
  Map,
  Compass,
  Backpack,
  Tent,
  House,
  Castle,
  Lightbulb,
  Palette,
  Music,
  Camera,
  BookOpen,
  Pin,
  Heart,
  Coffee,
  Leaf,
  Bird,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  CornerDownRight,
  RotateCw,
  Move,
  Circle,
  CircleDot,
  CircleDashed,
  Square,
  RectangleHorizontal,
  Triangle,
  Diamond,
  Pentagon,
  Hexagon,
  Octagon,
  MountainSnow,
  Sunrise,
  Sunset,
  Telescope,
  ShipWheel,
  TowerControl,
  Building2,
  Landmark,
  Fish,
  Bug,
  Sprout,
  Umbrella,
  Guitar,
} from "lucide-react";

export const symbols = {
  Sonne: Sun,
  Berge: Mountain,
  Palme: TreePalm,
  Flugzeug: Plane,
  Wolke: Cloud,
  Regen: CloudRain,
  Regenbogen: Rainbow,
  Mond: Moon,
  Stern: Star,
  Wald: Trees,
  Wellen: Waves,
  Blume: Flower2,
  Feuer: Flame,
  Schnee: Snowflake,
  Rakete: Rocket,
  Segelboot: Sailboat,
  Fahrrad: Bike,
  Zug: TrainFront,
  Auto: Car,
  Karte: Map,
  Kompass: Compass,
  Rucksack: Backpack,
  Zelt: Tent,
  Haus: House,
  Burg: Castle,
  Idee: Lightbulb,
  Malen: Palette,
  Musik: Music,
  Kamera: Camera,
  Buch: BookOpen,
  Pinnadel: Pin,
  Herz: Heart,
  Kaffee: Coffee,
  Blatt: Leaf,
  Vogel: Bird,
  "Pfeil nach oben": ArrowUp,
  "Pfeil nach unten": ArrowDown,
  "Pfeil nach links": ArrowLeft,
  "Pfeil nach rechts": ArrowRight,
  "Diagonaler Pfeil": ArrowUpRight,
  Doppelpfeil: ArrowLeftRight,
  Eckpfeil: CornerDownRight,
  Kreispfeil: RotateCw,
  Richtungskreuz: Move,
  Kreis: Circle,
  Punktkreis: CircleDot,
  "Gestrichelter Kreis": CircleDashed,
  Quadrat: Square,
  Rechteck: RectangleHorizontal,
  Dreieck: Triangle,
  Raute: Diamond,
  Fünfeck: Pentagon,
  Sechseck: Hexagon,
  Achteck: Octagon,
  Schneeberge: MountainSnow,
  Sonnenaufgang: Sunrise,
  Sonnenuntergang: Sunset,
  Teleskop: Telescope,
  Steuerrad: ShipWheel,
  Kontrollturm: TowerControl,
  Hochhäuser: Building2,
  Wahrzeichen: Landmark,
  Fisch: Fish,
  Insekt: Bug,
  Keimling: Sprout,
  Regenschirm: Umbrella,
  Gitarre: Guitar,
};
const legacy: Record<string, keyof typeof symbols> = {
  "☀️": "Sonne",
  "⛰️": "Berge",
  "🏔️": "Berge",
  "🌴": "Palme",
  "✈️": "Flugzeug",
  "❤️": "Herz",
  "⭐": "Stern",
  "🌙": "Mond",
  "🌊": "Wellen",
  "🌴️": "Palme",
};
export function SymbolArt({
  name,
  stroke,
  fill,
  width = 1.5,
}: {
  name: string;
  stroke: string;
  fill: string;
  width?: number;
}) {
  const key = legacy[name] ?? name;
  const Icon = Object.hasOwn(symbols, key)
    ? symbols[key as keyof typeof symbols]
    : null;
  return Icon ? (
    <Icon
      className="lm-symbol-art"
      stroke={stroke}
      fill={fill}
      strokeWidth={width}
      aria-hidden
    />
  ) : (
    <svg className="lm-symbol-art" viewBox="0 0 100 100" aria-hidden>
      <text
        x="50"
        y="53"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="70"
      >
        {name}
      </text>
    </svg>
  );
}
