export interface Relationship {
  id: string;
  targetId: string;
  description: string;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  personality: string;
  appearance: string; // booru-style tags
  relationships: Relationship[];
}

export interface SpatialRelation {
  id: string;
  targetId: string;
  description: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  spatialRelations: SpatialRelation[];
}

export interface Lore {
  premise: string;
  characters: Character[];
  locations: Location[];
}

export interface Settings {
  apiKey: string;
  mainModel: string;
  loreModel: string;
  outputWordCount: number;
}

export interface RelevanceResult {
  includePremise: boolean;
  characterIds: string[];
  locationIds: string[];
}

export interface LoreUpdateResult {
  updates: boolean;
  premise?: string | null;
  characters?: Character[];
  locations?: Location[];
}
