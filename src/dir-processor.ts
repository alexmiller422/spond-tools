import {readdir, readFile, stat, writeFile} from "node:fs/promises";
import {Stats} from "node:fs";
import path from "node:path";

async function* getMatchesFromDir(dir: string) {
    const dirContents = await readdir(dir);

    const sortedFiles = await Promise.all(
        dirContents.map<Promise<[string, Stats]>>(async (entry: string) => {
            const entryPath = path.join(dir, entry);
            const stats = await stat(entryPath);
            return [entryPath, stats];
        })
    ).then((candidates) =>
        candidates
            .filter(([, stats]) => stats.isFile())
            .sort(([, stats1], [, stats2]) => {
                if (stats1.birthtimeMs < stats2.birthtimeMs){
                    return -1;
                }
                else if ( stats1.birthtimeMs > stats2.birthtimeMs ) {
                    return 1;
                }
                else {
                    return 0;
                }
            })
            .map(([path,]) => path)
    );

    for (const file of sortedFiles) {
        const textData = await readFile(file, 'utf8');
        yield JSON.parse(textData);
    }
}

export function spondDumper(directory: string) {
    return async (spond: any) => {
        await writeFile(`${directory}/${spond.id}.json`, JSON.stringify(spond, null, 2))
            .catch((err: any) => console.error("Error writing spond", spond.id, err));
    }
}

export async function processDir(dir:string, spondHandler: (spond: any[]) => Promise<void>) {
    for await (const match of getMatchesFromDir(dir)) {
        await spondHandler(match);
    }
}
