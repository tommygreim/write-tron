import { Character, Location, Lore, RelevanceResult } from '../types';

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCharacter(char: Character, allChars: Character[]): string {
  const lines: string[] = [`Character: ${char.name}`];
  if (char.aliases.length > 0) {
    lines.push(`  Aliases: ${char.aliases.join(', ')}`);
  }
  if (char.personality) {
    lines.push(`  Personality: ${char.personality}`);
  }
  if (char.appearance) {
    lines.push(`  Appearance tags: ${char.appearance}`);
  }
  if (char.relationships.length > 0) {
    lines.push('  Relationships:');
    for (const rel of char.relationships) {
      const target = allChars.find((c) => c.id === rel.targetId);
      if (target) {
        lines.push(`    - ${target.name}: ${rel.description}`);
      }
    }
  }
  return lines.join('\n');
}

function formatLocation(loc: Location, allLocs: Location[]): string {
  const lines: string[] = [`Location: ${loc.name}`];
  if (loc.description) {
    lines.push(`  Description: ${loc.description}`);
  }
  if (loc.spatialRelations.length > 0) {
    lines.push('  Spatial relations:');
    for (const rel of loc.spatialRelations) {
      const target = allLocs.find((l) => l.id === rel.targetId);
      if (target) {
        lines.push(`    - Relative to ${target.name}: ${rel.description}`);
      }
    }
  }
  return lines.join('\n');
}

// ─── Relevance check ─────────────────────────────────────────────────────────

export function buildRelevanceMessages(lore: Lore, recentPassage: string) {
  const sections: string[] = [];

  if (lore.premise) {
    sections.push(`PREMISE:\n${lore.premise}`);
  }
  if (lore.characters.length > 0) {
    const texts = lore.characters.map(
      (c) => `[ID: ${c.id}]\n${formatCharacter(c, lore.characters)}`
    );
    sections.push(`CHARACTERS:\n${texts.join('\n\n')}`);
  }
  if (lore.locations.length > 0) {
    const texts = lore.locations.map(
      (l) => `[ID: ${l.id}]\n${formatLocation(l, lore.locations)}`
    );
    sections.push(`LOCATIONS:\n${texts.join('\n\n')}`);
  }

  const loreBlock = sections.join('\n\n---\n\n');

  return [
    {
      role: 'system' as const,
      content:
        'You are a story assistant. You identify relevant lore entries for a given story passage. Always respond with valid JSON only—no prose, no code fences.',
    },
    {
      role: 'user' as const,
      content: `Here are the lore entries for a story:\n\n${loreBlock}\n\n---\n\nHere is the most recent passage of the story (last 500 words):\n\n${recentPassage}\n\n---\n\nWhich lore entries are relevant to this passage? Respond with ONLY this JSON object (fill in the arrays with matching IDs):\n{\n  "includePremise": true,\n  "characterIds": [],\n  "locationIds": []\n}`,
    },
  ];
}

// ─── Main story continuation ──────────────────────────────────────────────────

export function buildStoryMessages(
  lore: Lore,
  relevance: RelevanceResult,
  storyText: string,
  outputWordCount: number
) {
  const sections: string[] = [];

  if (relevance.includePremise && lore.premise) {
    sections.push(`PREMISE & SETTING:\n${lore.premise}`);
  }

  const relevantChars = lore.characters.filter((c) => relevance.characterIds.includes(c.id));
  if (relevantChars.length > 0) {
    const texts = relevantChars.map((c) => formatCharacter(c, lore.characters));
    sections.push(`RELEVANT CHARACTERS:\n${texts.join('\n\n')}`);
  }

  const relevantLocs = lore.locations.filter((l) => relevance.locationIds.includes(l.id));
  if (relevantLocs.length > 0) {
    const texts = relevantLocs.map((l) => formatLocation(l, lore.locations));
    sections.push(`RELEVANT LOCATIONS:\n${texts.join('\n\n')}`);
  }

  const loreSection =
    sections.length > 0
      ? `## LORE CONTEXT\n\n${sections.join('\n\n---\n\n')}\n\n---\n\n`
      : '';

  return [
    {
      role: 'system' as const,
      content:
        'You are a creative writing assistant. Continue the story naturally from where it left off. Output only the story continuation—no commentary, no headers, no meta-text.',
    },
    {
      role: 'user' as const,
      content: `${loreSection}## STORY SO FAR\n\n${storyText}\n\n---\n\nContinue the story from exactly where it left off. Write approximately ${outputWordCount} words.`,
    },
  ];
}

// ─── Lore update check ───────────────────────────────────────────────────────

export function buildLoreUpdateMessages(lore: Lore, recentPassage: string) {
  const sections: string[] = [];

  if (lore.premise) {
    sections.push(`PREMISE:\n${lore.premise}`);
  }
  if (lore.characters.length > 0) {
    const texts = lore.characters.map(
      (c) => `[ID: ${c.id}]\n${formatCharacter(c, lore.characters)}`
    );
    sections.push(`CHARACTERS:\n${texts.join('\n\n')}`);
  }
  if (lore.locations.length > 0) {
    const texts = lore.locations.map(
      (l) => `[ID: ${l.id}]\n${formatLocation(l, lore.locations)}`
    );
    sections.push(`LOCATIONS:\n${texts.join('\n\n')}`);
  }

  const loreBlock = sections.join('\n\n---\n\n');

  return [
    {
      role: 'system' as const,
      content:
        'You are a story lore keeper. Review recent story content, update existing lore entries if needed, and create new entries for any new characters or locations introduced. Always respond with valid JSON only—no prose, no code fences.',
    },
    {
      role: 'user' as const,
      content: `Here are the current lore entries:\n\n${loreBlock}\n\n---\n\nHere is the recent story content:\n\n${recentPassage}\n\n---\n\nPlease do two things:\n1. Update any EXISTING lore entries if the story has introduced new information (corrected details, new traits, new relationships, etc.).\n2. Create NEW entries for any characters or locations that appear in the story passage but do NOT have an existing lore entry.\n\nSTRICT LENGTH LIMITS (to keep entries concise):\n- personality: max 80 words\n- appearance: max 40 booru-style tags, comma-separated\n- description (locations): max 80 words\n- premise: max 150 words\n- Each relationship/spatial-relation description: max 15 words\n\nIf nothing needs updating or creating, respond with exactly: {"updates": false}\n\nIf there are updates or new entries, respond with:\n{\n  "updates": true,\n  "premise": "updated premise text or null",\n  "updatedCharacters": [\n    {\n      "id": "existing-character-id",\n      "name": "Character Name",\n      "aliases": [],\n      "personality": "...",\n      "appearance": "...",\n      "relationships": [{"id": "rel-id-or-empty", "targetId": "char-id", "description": "..."}]\n    }\n  ],\n  "updatedLocations": [\n    {\n      "id": "existing-location-id",\n      "name": "Location Name",\n      "description": "...",\n      "spatialRelations": [{"id": "rel-id-or-empty", "targetId": "loc-id", "description": "..."}]\n    }\n  ],\n  "newCharacters": [\n    {\n      "name": "New Character Name",\n      "aliases": [],\n      "personality": "...",\n      "appearance": "...",\n      "relationships": []\n    }\n  ],\n  "newLocations": [\n    {\n      "name": "New Location Name",\n      "description": "...",\n      "spatialRelations": []\n    }\n  ]\n}\n\nPreserve all existing IDs exactly. Omit keys for arrays that have no changes.`,
    },
  ];
}
