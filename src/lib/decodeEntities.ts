// Decodifica entidades HTML em texto vindo de JSON-LD.
// Sites frequentemente entregam (e às vezes escapam duas vezes, ex.: "&amp;oacute;")
// entidades como &oacute; &ccedil; &deg; que precisam virar ó, ç, °.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  agrave: 'à', egrave: 'è', ograve: 'ò',
  Agrave: 'À',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
  atilde: 'ã', otilde: 'õ', ntilde: 'ñ',
  Atilde: 'Ã', Otilde: 'Õ',
  ccedil: 'ç', Ccedil: 'Ç',
  auml: 'ä', euml: 'ë', ouml: 'ö', uuml: 'ü',
  deg: '°', ordm: 'º', ordf: 'ª', middot: '·', hellip: '…',
  ndash: '–', mdash: '—', frac12: '½', frac14: '¼', frac34: '¾',
  times: '×', divide: '÷', eacutes: 'é',
};

function decodeOnce(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED[body] ?? match;
  });
}

/** Decodifica entidades HTML, lidando com escape duplo (ex.: "&amp;oacute;"). */
export function decodeEntities(input: string): string {
  if (!input || input.indexOf('&') === -1) return input;
  let out = decodeOnce(input);
  // Segunda passada resolve casos de duplo escape ("&amp;deg;" -> "&deg;" -> "°").
  if (out.indexOf('&') !== -1) out = decodeOnce(out);
  return out;
}
