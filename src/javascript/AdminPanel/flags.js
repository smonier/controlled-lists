const FLAG_MAP = {
    en: '🇬🇧',
    fr: '🇫🇷',
    de: '🇩🇪',
    es: '🇪🇸',
    it: '🇮🇹',
    pt: '🇵🇹',
    nl: '🇳🇱',
    ru: '🇷🇺',
    ja: '🇯🇵',
    zh: '🇨🇳',
    ar: '🇸🇦',
    ko: '🇰🇷',
    pl: '🇵🇱',
    tr: '🇹🇷',
    sv: '🇸🇪',
    da: '🇩🇰',
    no: '🇳🇴',
    fi: '🇫🇮',
    cs: '🇨🇿',
    el: '🇬🇷'
};

export const getFlagEmoji = langCode => FLAG_MAP[langCode] || '🌐';
