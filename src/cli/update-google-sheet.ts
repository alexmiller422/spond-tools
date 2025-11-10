import {Argv} from "yargs";
import {scrape} from "../scraper";
import {processSpond} from "../db-spond-processor";
import {processDir} from "../dir-processor";
import {updateGoogleSpreadSheet} from "../google-sheet";
import {Team} from "../db";
import {matchesFilter, notMatches} from "../filters";
import {readFileSync} from "fs";

type UpdateGoogleSheetArgs = {
    emailOrPhoneNumber: string | undefined,
    groupName: string | undefined,
    headless: boolean,
    password: string | undefined,
    spondCredentialsFile: string | undefined,
    spreadSheetId: string | undefined,
    sourceDirectory: string | undefined,
    trace: boolean,
}

export const command: string = "update-google-sheet <sheet-id>";

export const describe: string = "Update a Google Sheet with availability information";

export function builder(yargs: Argv): Argv<UpdateGoogleSheetArgs> {
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
    }).option('spondCredentialsFile', {
        alias: "spond-credentials-file",
        type: 'string',
        conflicts: ['emailOrPhoneNumber', "password"],
        requiresArg: true,
        description: "JSON file containing the Spond credentials to use"
    }).option('trace', {
        type: 'boolean',
        default: false,
        description: "Enable tracing in the browser, when scraping Sponds",
    });
}

function getCredentials(emailOrPhoneNumber: string | undefined, password: string | undefined, spondCredentialsFile: string | undefined): [string, string] {
    if (spondCredentialsFile !== undefined) {
        const credentials = JSON.parse(readFileSync(spondCredentialsFile, {encoding: 'utf8'}));
        return [credentials.emailOrPhoneNumber, credentials.password];
    }

    return [emailOrPhoneNumber!, password!];
}

export async function handler({emailOrPhoneNumber, groupName, headless, password, spondCredentialsFile, spreadSheetId, sourceDirectory, trace}: UpdateGoogleSheetArgs): Promise<void> {
    let ingester;
    if (sourceDirectory === undefined) {
        const [emailOrPhoneNumber2, password2] = getCredentials(emailOrPhoneNumber, password, spondCredentialsFile);
        ingester = scrape(headless, trace, emailOrPhoneNumber2, password2, groupName!, processSpond);
    }
    else {
        ingester = processDir(sourceDirectory!, processSpond);
    }
    await ingester;
    await updateGoogleSpreadSheet(spreadSheetId!, matchesFilter<Team>("$.name", "M[0-9].*"), notMatches("$.heading", ".*[T|t]raining"));
}

