/**
 * Memória de Elenco (castMemory.ts)
 * Indexa personagens a partir de verbos de elocução em diálogos
 * e garante que um personagem receba sempre a mesma voz e posicionamento estéreo da pág 1 à 300.
 */

export interface CharacterProfile {
  name: string;
  gender: 'female' | 'male';
  voiceId: string;
  spatialPan: number; // -0.25 (esquerda) ou +0.25 (direita)
}

export class CastMemory {
  private profiles = new Map<string, CharacterProfile>();
  private defaultFemaleVoice: string = 'pt-BR-FranciscaNeural';
  private defaultMaleVoice: string = 'pt-BR-AntonioNeural';

  constructor(femaleVoice?: string, maleVoice?: string) {
    if (femaleVoice) this.defaultFemaleVoice = femaleVoice;
    if (maleVoice) this.defaultMaleVoice = maleVoice;
  }

  /**
   * Tenta identificar o nome de um personagem associado a uma fala
   * Ex: "— Não vá agora! — disse Capitu." ou "respondeu Bentinho:"
   */
  public detectCharacterName(text: string): string | null {
    const dialogTagMatch = text.match(
      /(?:disse|falou|perguntou|respondeu|gritou|sussurrou|afirmou|exclamou)\s+([A-ZÁÉÍÓÚÂÊÔÃÕ][a-zàéíóúâêôãõ]+)/i
    );
    if (dialogTagMatch && dialogTagMatch[1]) {
      return dialogTagMatch[1];
    }
    return null;
  }

  /**
   * Obtém ou cria o perfil de um personagem, garantindo consistência.
   */
  public getOrAssignProfile(characterName: string): CharacterProfile {
    const key = characterName.toLowerCase();
    if (this.profiles.has(key)) {
      return this.profiles.get(key)!;
    }

    // Heurística de gênero para nomes em português (terminações em 'a' geralmente femininas)
    const isFemale = /[aã]$/i.test(characterName);
    const assignedVoice = isFemale ? this.defaultFemaleVoice : this.defaultMaleVoice;

    // Alterna panning espacial para dar profundidade estéreo nos diálogos
    const pan = isFemale ? -0.25 : 0.25;

    const profile: CharacterProfile = {
      name: characterName,
      gender: isFemale ? 'female' : 'male',
      voiceId: assignedVoice,
      spatialPan: pan,
    };

    this.profiles.set(key, profile);
    return profile;
  }

  public clear(): void {
    this.profiles.clear();
  }
}

export const castMemory = new CastMemory();
