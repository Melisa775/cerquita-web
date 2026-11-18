/**
 * Mazmorras: what the screens need to know about classes, powers and
 * monsters, plus the rulebook shown during the adventure. The rules live on
 * the server; this file only describes them for people.
 */

export const ABILITIES = {
  fue: 'Fuerza',
  des: 'Destreza',
  con: 'Constitución',
  int: 'Inteligencia',
  sab: 'Sabiduría',
  car: 'Carisma',
}

export const CLASSES = {
  guerrero: {
    label: 'Guerrero',
    emoji: '⚔️',
    color: '#B8432F',
    hp: 14,
    ac: 16,
    blurb: 'Aguanta golpes y los devuelve con fuerza. Puede recuperarse en medio de la pelea.',
    good: 'Fuerza y Constitución',
  },
  mago: {
    label: 'Mago',
    emoji: '🔮',
    color: '#5B4BC4',
    hp: 9,
    ac: 12,
    blurb: 'Poca vida y mucho poder: proyectiles que nunca fallan y una ola de trueno contra grupos.',
    good: 'Inteligencia y Sabiduría',
  },
  picaro: {
    label: 'Pícaro',
    emoji: '🗡️',
    color: '#2F7A52',
    hp: 10,
    ac: 14,
    blurb: 'Rápido y certero: daño extra cuando alguien más distrae al enemigo. Experto en trampas y cerraduras.',
    good: 'Destreza, Inteligencia y Carisma',
  },
  clerigo: {
    label: 'Clérigo',
    emoji: '✨',
    color: '#C99A1E',
    hp: 11,
    ac: 16,
    blurb: 'Cura a sus compañeros (incluso si cayeron) y castiga con luz sagrada.',
    good: 'Sabiduría y Carisma',
  },
}

/** target: who the power is aimed at ('monster', 'hero' or nothing). */
export const POWERS = {
  segundo_aliento: { label: 'Segundo aliento', emoji: '💨', target: null, uses: 'rest', text: 'Recuperas 1d10 + tu nivel de vida. Una vez por descanso.' },
  proyectil_magico: { label: 'Proyectil mágico', emoji: '✴️', target: 'monster', uses: 'slot', text: 'Tres dardos que nunca fallan: 3 × (1d4 + 1).' },
  ola_de_trueno: { label: 'Ola de trueno', emoji: '🌩️', target: null, uses: 'slot', text: 'Golpea a todos los enemigos: 2d8 (la mitad si resisten).' },
  ataque_furtivo: { label: 'Ataque furtivo', emoji: '🌘', passive: true, text: 'Si otro héroe sigue en pie, tus ataques hacen 1d6 extra.' },
  curar_heridas: { label: 'Curar heridas', emoji: '💖', target: 'hero', uses: 'slot', text: 'Un aliado recupera 1d8 + 3. Levanta a quien cayó.' },
  llama_sagrada: { label: 'Llama sagrada', emoji: '🔥', target: 'monster', uses: 'free', text: 'El enemigo resiste con Destreza (CD 13) o recibe 1d8. Sin tirada de ataque.' },
}

export const MONSTERS = {
  rata: 'Rata gigante',
  goblin: 'Goblin',
  lobo: 'Lobo',
  esqueleto: 'Esqueleto',
  cultista: 'Cultista',
  limo: 'Limo ácido',
  arana: 'Araña gigante',
  ogro: 'Ogro',
  rey_esqueleto: 'El Rey Olvidado (jefe)',
  dragon: 'Escamarroja, dragón joven (jefe)',
}

export const ADVENTURES = {
  cripta: { title: 'La cripta del Rey Olvidado', blurb: 'Muertos que no descansan, trampas antiguas y un rey de hielo. Más corta y amable.', emoji: '💀' },
  cueva: { title: 'La cueva de Escamarroja', blurb: 'Lobos, arañas, un ogro dormilón y un dragón joven. Más difícil.', emoji: '🐉' },
}

export const ITEMS = { llave_hueso: '🗝️ Llave de hueso' }

export const FEATURE_EMOJI = { chest: '🧰', trap: '⚠️', altar: '🕯️', sign: '📜', camp: '🔥', bridge: '🌉', sneak: '🤫' }

/** The rulebook, in chapters. Each paragraph is a string; lists are arrays. */
export const RULEBOOK = [
  {
    id: 'basics',
    title: 'Lo básico',
    emoji: '📖',
    body: [
      'Mazmorras es un juego de rol cooperativo: todos los héroes juegan juntos contra los peligros de la aventura. Ganan si derrotan al enemigo de la última sala; pierden si todos los héroes caen en una pelea.',
      'Hay un Dungeon Master (DM), que cuenta la historia y controla a los monstruos. Puede ser el sistema (automático) o una persona de la sala, que en ese caso no tiene héroe.',
      'Casi todo se decide con un dado de 20 caras (d20): se tira, se suma un modificador y se compara con un número. Si iguala o supera, sale bien.',
      ['d20 + modificador ≥ dificultad (CD) → lo logras.', 'Un 20 natural siempre sale bien; un 1 natural siempre falla (en ataques y pruebas).', '"2d6" quiere decir tirar dos dados de 6 caras y sumarlos.'],
    ],
  },
  {
    id: 'heroes',
    title: 'Los héroes',
    emoji: '🛡️',
    body: [
      'Cada persona elige una clase. Cada héroe tiene puntos de vida (PV), una armadura (CA: lo que un enemigo tiene que sacar para golpearte) y seis habilidades.',
      ['Guerrero ⚔️: mucha vida y armadura. "Segundo aliento" lo cura una vez por descanso.', 'Mago 🔮: poca vida. "Rayo de fuego" a voluntad, y con sus usos de magia, "Proyectil mágico" (nunca falla) y "Ola de trueno" (a todos).', 'Pícaro 🗡️: ataque furtivo (+1d6 si otro héroe sigue en pie) y el mejor para trampas, cofres y cerraduras.', 'Clérigo ✨: "Curar heridas" levanta a quien cayó; "Llama sagrada" no necesita tirada de ataque.'],
      'Los usos de magia (✦) se gastan y se recuperan al descansar.',
    ],
  },
  {
    id: 'abilities',
    title: 'Habilidades y pruebas',
    emoji: '🎲',
    body: [
      'Cuando un héroe intenta algo difícil, tira d20 + el modificador de la habilidad que corresponde. Si su clase es buena en esa habilidad, suma +2 de competencia (ya está incluido en tu ficha).',
      ['Fuerza (FUE): empujar, romper, trepar.', 'Destreza (DES): esquivar, abrir cerraduras, moverse sin ruido.', 'Constitución (CON): aguantar veneno, frío y cansancio.', 'Inteligencia (INT): recordar, descifrar runas, resolver acertijos.', 'Sabiduría (SAB): notar trampas, intuir, sentir lo sagrado.', 'Carisma (CAR): convencer, engañar, intimidar.'],
      'Dificultades típicas: 10 fácil, 13 normal, 15 difícil, 20 casi imposible.',
    ],
  },
  {
    id: 'explore',
    title: 'Explorar',
    emoji: '🗺️',
    body: [
      'La aventura es un mapa de salas. Toquen una puerta brillante para avanzar. Las salas que no han visto se descubren al entrar.',
      'Muchas salas tienen algo para intentar (un cofre, una trampa, un altar…). Elijan bien quién lo intenta: se puede una sola vez por sala y lo que pasa depende de la tirada.',
      ['Pociones 🧪: curan 2d4 + 2. Son del grupo y cualquiera puede usarlas.', 'Descansos 🏕️: dos por aventura. Recuperan la mitad de la vida, un uso de magia y el segundo aliento.', 'No se puede huir en medio de una pelea.'],
    ],
  },
  {
    id: 'combat',
    title: 'Combate',
    emoji: '⚔️',
    body: [
      'Al entrar en una sala con monstruos empieza la pelea. Todos tiran iniciativa (d20 + Destreza) y actúan en ese orden, una acción por turno:',
      ['Atacar: d20 + tu ataque contra la CA del enemigo. Si aciertas, tiras el daño de tu arma.', 'Usar un poder o un hechizo.', 'Defenderte: +3 de CA hasta tu próximo turno.', 'Tomar o dar una poción.'],
      'Golpe crítico: con un 20 natural tiras el doble de dados de daño.',
      'Si tu vida llega a 0, caes. No puedes actuar hasta que alguien te cure. Al terminar la pelea, los caídos se levantan con 1 PV.',
      'Los jefes tienen un ataque especial cada tres turnos que golpea a todos: tiren su salvación (d20 + la habilidad que se pida) para recibir solo la mitad.',
    ],
  },
  {
    id: 'levels',
    title: 'Experiencia y niveles',
    emoji: '⭐',
    body: [
      'Cada pelea ganada da experiencia (PX) a todos los héroes por igual.',
      ['Nivel 2 con 100 PX: más vida máxima y un uso de magia extra.', 'Nivel 3 con 250 PX: más vida, otro uso de magia y +1 al ataque y al daño.', 'Al subir de nivel, el héroe se recupera por completo.'],
    ],
  },
  {
    id: 'dm',
    title: 'Para el DM',
    emoji: '🎭',
    body: [
      'Si eres el Dungeon Master, tu trabajo es que la historia sea divertida, no ganarles. Tienes estas herramientas:',
      ['Narrar: escribe lo que ven, oyen o sienten. Aparece en la crónica de todos.', 'Pedir una prueba: elige héroe, habilidad y dificultad. El héroe tira y tú decides qué pasa.', 'Agregar un monstruo: si están explorando, empieza una pelea.', 'Curar o herir, y regalar una poción.', 'En la pelea, en el turno de cada monstruo, eliges a quién ataca (o "al azar").', 'Puedes mover al grupo y saltar el turno de alguien que no está.'],
      'Consejo: describe con los cinco sentidos, deja que los héroes propongan ideas locas y pide una prueba cuando el resultado sea incierto.',
    ],
  },
  {
    id: 'glossary',
    title: 'Glosario',
    emoji: '🔤',
    body: [
      ['PV: puntos de vida.', 'CA: clase de armadura. Lo que hay que sacar para golpearte.', 'CD: clase de dificultad de una prueba.', 'd20, d8, d6, d4: dados de 20, 8, 6 y 4 caras.', 'Salvación: una prueba para resistir algo que te pasa.', 'Iniciativa: el orden de los turnos en una pelea.', 'PX: puntos de experiencia.'],
    ],
  },
]
