import yargs from "yargs";
import {processDir} from "../dir-processor";
import {processSpond} from "../db-spond-processor";
import {saveWorkbook} from "../spreadsheet";
import {hideBin} from "yargs/helpers";

import * as DumpSpondsCmd from "./dump-sponds";
import * as UpdateGoogleSheetCmd from "./update-google-sheet";

yargs()
    .command(UpdateGoogleSheetCmd)
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
    .command(DumpSpondsCmd)
    .help()
    .parse(hideBin(process.argv));


