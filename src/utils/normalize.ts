import { v4 as uuidv4 } from 'uuid';
import { Character, Location, Lore, Relationship, SpatialRelation } from '../types';

/** Ensure every field of a Relationship has the right type (guards AI-returned data). */
function normalizeRelationship(r: Partial<Relationship>): Relationship {
  return {
    id: (r.id && typeof r.id === 'string') ? r.id : uuidv4(),
    targetId: (r.targetId && typeof r.targetId === 'string') ? r.targetId : '',
    description: typeof r.description === 'string' ? r.description : '',
  };
}

/** Ensure every field of a SpatialRelation has the right type. */
function normalizeSpatialRelation(r: Partial<SpatialRelation>): SpatialRelation {
  return {
    id: (r.id && typeof r.id === 'string') ? r.id : uuidv4(),
    targetId: (r.targetId && typeof r.targetId === 'string') ? r.targetId : '',
    description: typeof r.description === 'string' ? r.description : '',
  };
}

/**
 * Normalise a character object that may have come from localStorage or an AI
 * response. Ensures all array fields are always actual arrays.
 */
export function normalizeCharacter(raw: Partial<Character> & { id?: string }): Character {
  return {
    id: (raw.id && typeof raw.id === 'string') ? raw.id : uuidv4(),
    name: typeof raw.name === 'string' ? raw.name : '',
    aliases: Array.isArray(raw.aliases) ? raw.aliases.filter((a) => typeof a === 'string') : [],
    personality: typeof raw.personality === 'string' ? raw.personality : '',
    appearance: typeof raw.appearance === 'string' ? raw.appearance : '',
    relationships: Array.isArray(raw.relationships)
      ? raw.relationships.map(normalizeRelationship)
      : [],
  };
}

/**
 * Normalise a location object that may have come from localStorage or an AI response.
 */
export function normalizeLocation(raw: Partial<Location> & { id?: string }): Location {
  return {
    id: (raw.id && typeof raw.id === 'string') ? raw.id : uuidv4(),
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    spatialRelations: Array.isArray(raw.spatialRelations)
      ? raw.spatialRelations.map(normalizeSpatialRelation)
      : [],
  };
}

/** Normalise an entire Lore object. */
export function normalizeLore(raw: Partial<Lore>): Lore {
  return {
    premise: typeof raw.premise === 'string' ? raw.premise : '',
    characters: Array.isArray(raw.characters) ? raw.characters.map(normalizeCharacter) : [],
    locations: Array.isArray(raw.locations) ? raw.locations.map(normalizeLocation) : [],
  };
}
