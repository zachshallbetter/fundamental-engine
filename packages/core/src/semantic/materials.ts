/**
 * Interaction materials (interaction §24, visual §11). Forces define behavior; materials define
 * *feel*. Each material is a named composition of real force tokens (current names — viscosity, not
 * drag; wall, not reflect) plus a suggested render layer. Validated against the passport registry
 * by the test, so a material can't reference a force that doesn't exist.
 */
import type { RenderLayer } from '../recipes/schema.ts';

export type InteractionMaterial =
  | 'glass'
  | 'rubber'
  | 'liquid'
  | 'plasma'
  | 'dust'
  | 'metal'
  | 'fabric'
  | 'paper'
  | 'stone'
  | 'smoke';

export interface MaterialRecipe {
  /** force tokens that give the material its feel. */
  tokens: string[];
  /** render layers that suit it. */
  render?: RenderLayer[];
  /** the doc's plain description. */
  note: string;
}

export const INTERACTION_MATERIALS: Readonly<Record<InteractionMaterial, MaterialRecipe>> = {
  glass: { tokens: ['lens', 'wall'], note: 'lens + reflect + low drag' },
  rubber: { tokens: ['tether', 'viscosity'], note: 'spring + damping' },
  liquid: { tokens: ['cohesion', 'pressure'], render: ['metaballs'], note: 'cohesion + pressure' },
  plasma: { tokens: ['fieldflow', 'thermal'], render: ['trails', 'field-lines'], note: 'fieldflow + thermal + trails' },
  dust: { tokens: ['diffuse'], note: 'diffuse + low mass' },
  metal: { tokens: ['magnetism', 'wall'], note: 'magnetism + reflect' },
  fabric: { tokens: ['link', 'shear'], note: 'link + shear' },
  paper: { tokens: ['memory'], note: 'low motion + memory' },
  stone: { tokens: ['wall'], note: 'high mass + low response' },
  smoke: { tokens: ['diffuse', 'stream'], render: ['trails'], note: 'diffuse + stream + entropy' },
};

/** The `data-body` token string for a material. */
export function materialBody(material: InteractionMaterial): string {
  return INTERACTION_MATERIALS[material].tokens.join(' ');
}
