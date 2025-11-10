import jp from "jsonpath";

export function notMatches<T>(path: string, expression: string) {
    const matches = matchesFilter<T>(path, expression);

    return (item: T) => !matches(item);
}

export function matchesFilter<T>(path: string, matchExpression: string) {
    const regexp = new RegExp(matchExpression);
    return (item: T) => {
        const elements = jp.query(item, path);

        for(const element of elements) {
            if (regexp.test(element)) {
                return true;
            }
        }

        return false;
    }
}
