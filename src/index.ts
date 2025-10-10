import {Stats} from "node:fs";
import {readdir, readFile, stat, writeFile} from "node:fs/promises";
import {chromium, Response} from "playwright";
import * as XLSX from "xlsx";
import yargs from 'yargs';

import {login} from "./spond";
import {MatchAvailabilities, Member, Team, upsertAvailabilities, upsertTeam} from "./db";
import { default as path } from "node:path";
import {createWorkbook} from "./spreadsheet";
import {hideBin} from "yargs/helpers";

async function processMatch(match: any) {
    const subGroups: any[] = match.recipients.group.subGroups;
    if (subGroups === undefined) {
        return;
    }

    const membersById: Map<string, Member> = match.recipients.group.members.reduce((acc: Map<string, Member>, member: any) => {
        acc.set(member.id, {id: member.id, firstName: member.firstName, lastName: member.lastName});
        return acc;
    }, new Map<string, Member>());

    for (const group of subGroups) {
        const team: Team = {
            id: group.id,
            name: group.name
        };

        const matchAvailabilities: MatchAvailabilities = {
            matchId: match.id,
            subgroupId: group.id,
            heading: match.heading,
            date: match.startTimestamp,
            acceptedIds: match.responses.acceptedIds,
            declinedIds: match.responses.declinedIds,
            unansweredIds: match.responses.unansweredIds,
            waitingListIds: match.responses.waitinglistIds,
            unconfirmedIds: match.responses.unconfirmedIds,
        }

        if (match.matchInfo !== undefined) {
            match.matchInfo = {
                teamName: match.matchInfo.teeamName,
                opponentName: match.matchInfo.opponentName,
                type: match.matchInfo.type,
            };
        }

        const teamMembers = matchAvailabilities.acceptedIds
            .concat(matchAvailabilities.declinedIds)
            .concat(matchAvailabilities.unansweredIds)
            .concat(matchAvailabilities.waitingListIds)
            .concat(matchAvailabilities.unconfirmedIds)
            .map<Member | string>((memberId) => {
                const result = membersById.get(memberId);
                if (result === undefined) {
                    return memberId;
                }

                return result
            });

        upsertTeam(team, teamMembers);
        upsertAvailabilities(team, matchAvailabilities)
    }
}

function spondDumper(directory: string) {
    return async (sponds: any[]) => {
        for (const spond of sponds) {
            await writeFile(`${directory}/${spond.id}.json`, JSON.stringify(spond, null, 2))
                .catch((err: any) => console.error("Error writing spond", spond.id, err));
        }
    }
}

function responseHandler(spondHandler: (sponds: any) => Promise<void>) {
    return (response: Response) => {
        if (response.request().method() === "GET" && response.request().url().includes('/sponds') && response.status() == 200) {
            response.json().then(spondHandler)
        }
    }
}

async function scrape(
    emailOrPhoneNumber: string, password: string, groupName: string, spondHandler: (spond: any[]) => Promise<void>,
) {
    const browser = await chromium.launch({headless: false});
    const context = await browser.newContext();
    await context.tracing.start({screenshots: true, snapshots: true});
    const page = await context.newPage();
    page.on('response', responseHandler(spondHandler));


    const client = await login(page, emailOrPhoneNumber, password);

    const group = await client.navigateToGroup(groupName);
    await group.scrollAllEvents();

    await page.close();
    await context.tracing.stop({path: "trace.zip"});
    await browser.close();
}

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

async function processDir(dir:string, filename: string) {
    for await (const match of getMatchesFromDir(dir)) {
        await processMatch(match);
    }

    const workbook = createWorkbook();
    XLSX.writeFile(workbook, filename, {type: "file", bookType: "xlsx"})
}

yargs()
    .command("process-directory <directory> <filename>", "process individual Sponds from JSON files in <dirstory>",
        (yargs) => {
            return yargs.positional('directory', {
                type: "string",
                description: "Directory containing Sponds",
                required: true,
            }).positional('filename', {
                type: "string",
                description: "Mame of the Excel workbook to output",
                required: true,
            });
        },
        async ({directory, filename}) => {
            await processDir(directory!, filename!);
        }
    )
    .command("dump-sponds [options] <username> <group> <directory>", "Scrape the Spond web application and write each Spond for <group> to a JSON file, in <direcotry>.",
        (yargs) => {
            return yargs.positional('username', {
                type: 'string',
                description: "Username to login to Spond with",
                required: true,
            }).positional('group', {
                type: 'string',
                description: "Group to get Sponds for",
                required: true,
            }).positional('directory', {
                type: "string",
                description: "Directory to write Spond JSON files in",
                required: true,
            }).option('password', {
                type: 'string',
                description: "Password to login to Spond with",
                demandOption: true,
            })
        },
        async ({username, password, directory, group}) => {
            await scrape(username!, password, group!, spondDumper(directory!));
        })
    .help()
    .parse(hideBin(process.argv));
//scrape(process.argv[2], process.argv[3])
