import {Argv} from "yargs";
import {spondDumper} from "../dir-processor";
import {scrape} from "../scraper";

export const command = "dump-sponds [options] <username> <group> <directory>";
export const describe = "Scrape the Spond web application and write each Spond for <group> to a JSON file, in <direcotry>.";

type DumpSpondsArgs = {
    username: string | undefined,
    group: string | undefined,
    directory: string | undefined,
    password: string | undefined,
    headless: boolean,
    trace: boolean
}

export function builder(yargs: Argv<{}>) {
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
    }).option('trace', {
        type: 'boolean',
        description: "Set to true to enable Playwright tracing",
        default: false,
        requiresArg: true
    }).option("headless", {
        type: 'boolean',
        description: "Set to false to show Playwright browser",
        default: true,
        requiresArg: true
    })
}

export async function handler ({username, password, directory, group, headless, trace}: DumpSpondsArgs) {
    await scrape(headless, trace, username!, password!, group!, spondDumper(directory!));
}