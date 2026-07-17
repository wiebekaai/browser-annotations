export type SourceLocation = {
  file: string;
  line: number;
  column: number;
};

export type SourceContext = {
  framework: "svelte" | "react" | "solid";
  location?: SourceLocation;
};
