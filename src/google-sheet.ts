import {sheets, sheets_v4} from "@googleapis/sheets";
import {differenceInDays} from "date-fns";
import {GaxiosPromise, GaxiosOptionsPrepared} from "gaxios";
import {GoogleAuth} from "google-auth-library";
import pThrottle from "p-throttle"

import {getTeamAvailabilities, getTeamMembers, getTeams, MatchAvailabilities, Team} from "./db";
import {memberComparator} from "./comparators";

import Request = sheets_v4.Schema$Request;
import Schema$Sheet = sheets_v4.Schema$Sheet;
import Schema$Spreadsheet = sheets_v4.Schema$Spreadsheet;
import Sheets = sheets_v4.Sheets;
import SheetProperties = sheets_v4.Schema$SheetProperties;

const COLUMN_OFFSET = 2;
const ROW_OFFSET = 7;

const EPOCH = new Date(1899, 11, 30);

function columnIndexToLetter(index: number): string {
    const a = Math.floor(index/26);
    if (a < 0) {
        return "";
    }
    return columnIndexToLetter((a-1)) + String.fromCharCode(65+ (index % 26));
}

async function createOrReplaceSheet(client: Sheets, spreadsheet: Schema$Spreadsheet, team: Team, index: number): Promise<SheetProperties> {
    const requests: Request[] = [];

    const sheet = spreadsheet.sheets?.find(matchTeam(team))
    if (sheet !== undefined) {
        requests.push({deleteSheet: {
                sheetId: sheet.properties!.sheetId,
            }})
    }

    requests.push({
        addSheet: {
            properties: {
                title: team.name,
                index: index
            }
        }
    })

    const requestBody = {
        requests
    }

    const response = await client.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheet.spreadsheetId!,
        requestBody: requestBody,
    });

     const addResponse = response.data.replies!.pop()!;
     return addResponse.addSheet?.properties!;
}

async function addMemberColumn(client: Sheets, spreadsheetId: string, sheet: SheetProperties, team: Team): Promise<Map<string, number>> {
    const teamMembers = getTeamMembers(team.id)
        .sort(memberComparator);

    const rowIndexById = teamMembers.reduce<Map<string, number>>((acc, member, idx) => {
        const key = typeof member === 'string' ? member : member.id;
        acc.set(key, idx + ROW_OFFSET)
        return acc
    }, new Map<string, number>());

    const values: any[][] = [];

    for (const teamMember of teamMembers) {
        let name: string, id: string;

        if (typeof teamMember === 'string') {
            name = teamMember;
            id = teamMember;
        }
        else {
            name = `${teamMember.firstName} ${teamMember.lastName}`;
            id = teamMember.id;
        }

        values.push([id, name]);
    }


    await client.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: `'${sheet.title}'!A${ROW_OFFSET + 1}:B`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            majorDimension: "ROWS",
            values: values
        }
    });

    return rowIndexById;
}

function matchTeam(team: Team) {
    return (sheet: Schema$Sheet) => {
        return sheet.properties?.title === team.name;
    }
}

function availabilitiesComparator(left: MatchAvailabilities, right: MatchAvailabilities): number {
    return left.date.localeCompare(right.date);
}

function counter(columnIndex: number, value: string): string {
    const column = columnIndexToLetter(columnIndex);
    return `=CONCAT("${value}: ", COUNTIF(${column}${ROW_OFFSET+1}:${column}, "${value}"))`;
}

function googleSheetsDate(date: string): number {
    return differenceInDays(date, EPOCH);
}

async function addAvailabilities(client: sheets_v4.Sheets, spreadsheetId: string, sheet: sheets_v4.Schema$SheetProperties, team: Team, rowsByMember: Map<string, number>, availabilities: MatchAvailabilities[]) {
    const values: any[][] = [];

    let columnIndex = COLUMN_OFFSET;
    for (const availability of availabilities) {
        const column: any[] = new Array(rowsByMember.size + ROW_OFFSET);

        function addAvailability(memberIds: string[], status: string) {
            for (const memberId of memberIds) {
                const rowIndex = rowsByMember.get(memberId)!;
                column[rowIndex] = status;
            }
        }

        column[0] = availability.matchId;
        column[1] = googleSheetsDate(availability.date);

        const [opponent, type] = availability.matchInfo === undefined ?
            [availability.heading, undefined] :
            [availability.matchInfo.opponentName, availability.matchInfo.type];

        column[2] = opponent;
        column[3] = type;

        column[4] = counter(columnIndex, "Accepted");
        column[5] = counter(columnIndex, "Unanswered");
        column[6] = counter(columnIndex, "Declined");


        addAvailability(availability.acceptedIds, "Accepted");
        addAvailability(availability.declinedIds, "Declined");
        addAvailability(availability.unansweredIds, "Unanswered");
        addAvailability(availability.unconfirmedIds, "Unconfirmed");
        addAvailability(availability.waitingListIds, "Wait list");

        values.push(column);

        columnIndex ++;
    }

    await client.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: `'${sheet.title}'!${columnIndexToLetter(COLUMN_OFFSET)}1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            majorDimension: "COLUMNS",
            values: values
        }
    });

}

async function formatSheet(client: Sheets, spreadsheetId: string, sheet: SheetProperties) {
    const requests: Request[] = [];

    requests.push({
        updateSheetProperties: {
            properties: {
                sheetId: sheet.sheetId,
                gridProperties: {
                    frozenColumnCount: COLUMN_OFFSET,
                    frozenRowCount: ROW_OFFSET
                }
            },
            fields: "gridProperties.frozenColumnCount,gridProperties.frozenRowCount",
        }
    });

    requests.push({
        updateDimensionProperties: {
            properties: {
                hiddenByUser: true
            },
            range: {
                sheetId: sheet.sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 1
            },
            fields: "hiddenByUser"
        },
    });

    requests.push({
        updateDimensionProperties: {
            properties: {
                hiddenByUser: true
            },
            range: {
                sheetId: sheet.sheetId,
                dimension: 'ROWS',
                startIndex: 0,
                endIndex: 1
            },
            fields: "hiddenByUser",
        },
    });

    requests.push({
        repeatCell: {
            range: {
                sheetId: sheet.sheetId,
                startColumnIndex: COLUMN_OFFSET,
                startRowIndex: 1,
                endRowIndex: 2
            },
            cell: {
                userEnteredFormat: {
                    numberFormat: {
                        type: 'DATE',
                        pattern: 'dd/mm/yyyy'
                    }
                }
            },
            fields: "userEnteredFormat.numberFormat.pattern,userEnteredFormat.numberFormat.type"
        }
    })

    requests.push({
        autoResizeDimensions: {
            dimensions: {
                sheetId: sheet.sheetId,
                dimension: 'COLUMNS',
                startIndex: 1,
            }
        }
    })

    await client.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
            requests
        }
    })
}

export async function updateGoogleSpreadSheet(spreadsheetId: string, teamFilter?: (value: Team) => boolean, matchFilter?: (value: MatchAvailabilities) => boolean ) {
    if (teamFilter === undefined){
        teamFilter = () => true;
    }

    if (matchFilter === undefined) {
        matchFilter = () => true;
    }

    const teams = getTeams()
        .filter(teamFilter)
        .sort(
            (team1, team2) => team1.name.localeCompare(team2.name)
        );

    if (teams.length === 0) {
        return;
    }

    const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/spreadsheets']});

    const throttle = pThrottle({
        limit: 10,
        interval: 15000,
    });
    const adapter = throttle(
        async (options: GaxiosOptionsPrepared, defaultAdapter: (options: GaxiosOptionsPrepared) => GaxiosPromise<any>) => {
            return await defaultAdapter(options);
        }
    );

    const client = sheets({version: "v4", auth, adapter});

    const spreadsheet = await client.spreadsheets.get({
        spreadsheetId: spreadsheetId,
    });

    for(let i = 0; i < teams.length; i++) {
        const team = teams[i];
        try {
            const availabilities = getTeamAvailabilities(team.id)
                .filter(matchFilter)
                .sort(availabilitiesComparator);

            if (availabilities.length === 0) {
                continue;
            }

            const sheet = await createOrReplaceSheet(client, spreadsheet.data, team, i);

            const rowsByMember = await addMemberColumn(client, spreadsheetId, sheet, team);

            await addAvailabilities(client, spreadsheetId, sheet, team, rowsByMember, availabilities);

            await formatSheet(client, spreadsheetId, sheet);
        }
        catch (e) {
            // log.error(e, "Error creating sheet for team: %s", team.name);
            console.error(`Error creating sheet for team: ${team.name}`, e);
        }
    }
}