export const calculateTokenCost = (tokens: number): { usd: number, rub: number } => {
    // Blended average cost estimation (mix of input/output and Flash/Pro)
    const USD_PER_1M_TOKENS = 2.50; 
    // Approximate current exchange rate
    const RUB_PER_USD = 95.00; 

    const usd = (tokens / 1000000) * USD_PER_1M_TOKENS;
    const rub = usd * RUB_PER_USD;
    
    return { usd, rub };
};

export const formatTokenCost = (tokens: number): string => {
    const { rub } = calculateTokenCost(tokens);
    if (rub < 0.01) return '< 0.01 ₽';
    return `${rub.toFixed(2)} ₽`;
};
