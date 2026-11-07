// Loads /data/*.json and checks every link. Returns { ref, problems }.
import { SUFFIXES, normName, fullName } from './util.js';
import { t } from './strings.js';

const FILES = {
  citationTypes: 'citation-types.json',
  violationTypes: 'violation-types.json',
  agencies: 'agencies.json',
  enforcers: 'enforcers.json',
  admins: 'admins.json',
  violators: 'violators.json',
};

export async function loadReference() {
  const ref = {};
  const problems = [];
  await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    try {
      const res = await fetch('data/' + file, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      ref[key] = await res.json();
      if (!Array.isArray(ref[key])) throw new Error('expected a list [ … ]');
    } catch (e) {
      problems.push({ file, entry: '', text: t('dataLoadFailed', { file, error: e.message }) });
      ref[key] = [];
    }
  }));
  if (!problems.length) problems.push(...validate(ref));
  return { ref, problems };
}

export function validate(ref) {
  const out = [];
  const p = (file, entry, text) => out.push({ file, entry, text });
  const F = FILES;

  // citation-types
  const ctIds = new Set();
  ref.citationTypes.forEach((c, i) => {
    const e = c.id || `#${i + 1}`;
    if (!c.id) p(F.citationTypes, e, 'Missing "id".');
    else if (ctIds.has(c.id)) p(F.citationTypes, e, `Duplicate id "${c.id}".`);
    ctIds.add(c.id);
    if (!c.name) p(F.citationTypes, e, 'Missing "name".');
    if (typeof c.needsPlatePhoto !== 'boolean') p(F.citationTypes, e, '"needsPlatePhoto" must be true or false.');
  });

  // violation-types
  const vt = new Map();
  ref.violationTypes.forEach((v, i) => {
    const e = v.id || `#${i + 1}`;
    if (!v.id) p(F.violationTypes, e, 'Missing "id".');
    else if (vt.has(v.id)) p(F.violationTypes, e, `Duplicate id "${v.id}".`);
    if (!v.name) p(F.violationTypes, e, 'Missing "name".');
    if (!ctIds.has(v.citationType)) p(F.violationTypes, e, `citationType "${v.citationType}" doesn’t exist in ${F.citationTypes}.`);
    vt.set(v.id, v);
  });

  // agencies
  const agIds = new Set();
  ref.agencies.forEach((a, i) => {
    const e = a.id || `#${i + 1}`;
    if (!a.id) p(F.agencies, e, 'Missing "id".');
    else if (agIds.has(a.id)) p(F.agencies, e, `Duplicate id "${a.id}".`);
    agIds.add(a.id);
    if (!a.name) p(F.agencies, e, 'Missing "name".');
    if (!Array.isArray(a.citationTypes) || !a.citationTypes.length) p(F.agencies, e, 'Needs at least one Citation Type.');
    (a.citationTypes || []).forEach(c => { if (!ctIds.has(c)) p(F.agencies, e, `Citation Type "${c}" doesn’t exist.`); });
    if (!Array.isArray(a.violationTypes)) p(F.agencies, e, '"violationTypes" must be a list.');
    (a.violationTypes || []).forEach(v => {
      const def = vt.get(v);
      if (!def) p(F.agencies, e, `Violation "${v}" doesn’t exist.`);
      else if (!(a.citationTypes || []).includes(def.citationType)) p(F.agencies, e, `Violation "${v}" is a ${def.citationType} Violation, but the Agency doesn’t cover that type.`);
    });
  });

  // people
  const ids = new Set();
  const names = new Map();
  const checkPerson = (file, x, i, sexKey) => {
    const e = x.id || `#${i + 1}`;
    if (!x.id) p(file, e, 'Missing "id".');
    else if (ids.has(x.id)) p(file, e, `id "${x.id}" is already used.`);
    ids.add(x.id);
    if (!x.first) p(file, e, 'Missing first name.');
    if (!x.last) p(file, e, 'Missing last name.');
    if (!['M', 'F'].includes(x[sexKey])) p(file, e, `"${sexKey}" must be "M" or "F".`);
    if (!SUFFIXES.includes(x.suffix || '')) p(file, e, `Suffix "${x.suffix}" isn’t one of: ${SUFFIXES.filter(Boolean).join(', ')}.`);
    if (/pass(word)?/i.test(Object.keys(x).join(' '))) p(file, e, 'Remove the password: no passwords in data files.');
  };
  ref.enforcers.forEach((x, i) => {
    checkPerson(F.enforcers, x, i, 'gender');
    if (!agIds.has(x.agency)) p(F.enforcers, x.id || `#${i + 1}`, `Agency "${x.agency}" doesn’t exist.`);
  });
  const officeByAgency = new Map();
  ref.admins.forEach((x, i) => {
    const e = x.id || `#${i + 1}`;
    checkPerson(F.admins, x, i, 'gender');
    if (!['office', 'verifier', 'super'].includes(x.role)) p(F.admins, e, '"role" must be "office", "verifier" or "super".');
    if (x.role === 'office') {
      if (!agIds.has(x.agency)) p(F.admins, e, `Agency "${x.agency}" doesn’t exist.`);
      else if (officeByAgency.has(x.agency)) p(F.admins, e, `Agency ${x.agency} already has an Office Admin (${officeByAgency.get(x.agency)}).`);
      officeByAgency.set(x.agency, x.id);
    }
  });
  [...ref.enforcers.map(x => [F.enforcers, x]), ...ref.admins.map(x => [F.admins, x])].forEach(([file, x]) => {
    const k = normName(fullName(x));
    if (names.has(k)) p(file, x.id, `Full name "${fullName(x)}" is also used by ${names.get(k)}. Everyone signs in by full name.`);
    else names.set(k, x.id);
  });

  // violators
  if (!ref.violators.length) p(F.violators, '', 'Needs at least one entry.');
  const vlIds = new Set();
  ref.violators.forEach((x, i) => {
    const e = x.id || `#${i + 1}`;
    if (!/^VL-\d{4,}$/.test(x.id || '')) p(F.violators, e, 'id must be "VL-" followed by 4 or more digits.');
    else if (vlIds.has(x.id)) p(F.violators, e, `Duplicate id "${x.id}".`);
    vlIds.add(x.id);
    if (!x.first) p(F.violators, e, 'Missing first name.');
    if (!x.last) p(F.violators, e, 'Missing last name.');
    if (!['M', 'F'].includes(x.sex)) p(F.violators, e, '"sex" must be "M" or "F".');
    if (x.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(x.birthday)) p(F.violators, e, 'birthday must look like YYYY-MM-DD.');
    if (!SUFFIXES.includes(x.suffix || '')) p(F.violators, e, `Suffix "${x.suffix}" isn’t in the list.`);
  });

  return out;
}
