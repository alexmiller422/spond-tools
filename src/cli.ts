import {hideBin} from "yargs/helpers";
import yargs, {Argv, group} from "yargs";
import {updateGoogleSpreadSheet} from "./google-sheet";
import {processDir, spondDumper} from "./dir-processor";
import {saveWorkbook} from "./spreadsheet";
import {scrape} from "./scraper";
import jp from "jsonpath";
import {Team} from "./db";
import {processSpond} from "./db-spond-processor";

function notMatches<T>(path: string, expression: string) {
    const matches = matchesFilter<T>(path, expression);

    return (item: T) => !matches(item);
}

function matchesFilter<T>(path: string, matchExpression: string) {
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

type UpdateGoogleSheetArgs = {
    emailOrPhoneNumber: string | undefined,
    groupName: string | undefined,
    headless: boolean,
    password: string | undefined,
    spreadSheetId: string | undefined,
    sourceDirectory: string | undefined,
    trace: boolean,
}

async function updateGoogleSheetCmd({emailOrPhoneNumber, groupName, headless, password, spreadSheetId, sourceDirectory, trace}: UpdateGoogleSheetArgs): Promise<void> {
    let source;
    if (sourceDirectory === undefined) {
        source = scrape(headless, trace, emailOrPhoneNumber!, password!, groupName!, processSpond);
    }
    else {
        source = processDir(sourceDirectory!, processSpond);
    }
    await source;
    await updateGoogleSpreadSheet(spreadSheetId!, matchesFilter<Team>("$.name", "M[0-9].*"), notMatches("$.heading", ".*[T|t]raining"));
}

yargs()
    .command("update-google-sheet <sheet-id>", "Update a Google Sheet with availability information",
        (yargs: Argv<{}>): Argv<UpdateGoogleSheetArgs> => {
            return yargs.positional('spreadSheetId', {
                alias: 'sheet-id',
                type: 'string',
                description: 'ID of the Google Sheet to update',
                required: true,
            }).option('emailOrPhoneNumber', {
                alias: "email-or-phone-number",
                type: 'string',
                conflicts: "sourceDirectory",
                requiresArg: true,
                description: "Email or Phone number to log into Spond with",
            }).option('groupName', {
                alias: "group-name",
                type: 'string',
                conflicts: "sourceDirectory",
                requiresArg: true,
                description: "Group to scrape Sponds for",
            }).option('headless', {
                type: 'boolean',
                default: true,
                description: "Scrape Sponds with a headless browser"
            }).option('password', {
                type: 'string',
                conflicts: "sourceDirectory",
                requiresArg: true,
                description: "Password to log into Spond with",
            }).option('sourceDirectory', {
                alias: "source-directory",
                type: 'string',
                conflicts: ["emailOrPhoneNumber", "groupName", "password"],
                requiresArg: true,
                description: "Directory containing Sponds"
            }).option('trace', {
                type: 'boolean',
                default: false,
                description: "Enable tracing in the browser, when scraping Sponds",
            });
        },
        updateGoogleSheetCmd
    )
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
            await processDir(directory!, processSpond);
            saveWorkbook(filename!);
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
            await scrape(false, true, username!, password, group!, spondDumper(directory!));
        })
    .help()
    .parse(hideBin(process.argv));
