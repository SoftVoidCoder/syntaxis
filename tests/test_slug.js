// Generate slug
function createCheckoSlug(name, ogrn) {
    if (!name || !ogrn) return ogrn;

    const cyrillicToLatin = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    // Checko cleans up names: removes quotes, converts spaces to hyphens, transliterates
    let slug = name.toLowerCase()
        .replace(/["«»']/g, '') // remove quotes
        .replace(/[^а-яa-z0-9\s-]/g, ' ') // keep only letters, numbers, spaces, hyphens
        .trim()
        .replace(/\s+/g, '-') // spaces to hyphens
        .split('').map(char => cyrillicToLatin[char] || char).join('');

    return `https://checko.ru/company/${slug}-${ogrn}`;
}

console.log(createCheckoSlug('ПАО "ФОСАГРО"', '1027700190572'));
console.log(createCheckoSlug('АО «МХК «ЕвроХим»', '1027700002659'));
