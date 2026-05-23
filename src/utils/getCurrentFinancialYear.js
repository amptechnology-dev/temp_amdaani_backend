export const getCurrentFinancialYear = () => {
    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        today.getMonth() + 1;

    if (month >= 4) {
        return `${year}-${String(
            year + 1
        ).slice(-2)}`;
    }

    return `${year - 1}-${String(
        year
    ).slice(-2)}`;
};