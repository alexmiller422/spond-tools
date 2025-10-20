import * as XLSX from "xlsx";
import {getTeamAvailabilities, getTeamMembers, getTeams, MatchAvailabilities} from "./db";
import {memberComparator} from "./comparators";


const availabilitiesComparator = (left: MatchAvailabilities) => {
    return left.date.localeCompare(left.date);
}

const ROW_OFFSET = 3;

export function createWorkbook() {
    const workbook = XLSX.utils.book_new();

    const teams = getTeams().sort(
        (team1, team2) => team1.name.localeCompare(team2.name)
    );

    for(const team of teams) {
        const teamMembers = getTeamMembers(team.id)
            .sort(memberComparator);

        const rowIndexById = teamMembers.reduce<Map<string, number>>((acc, member, idx) => {
            const key = typeof member === 'string' ? member : member.id;
            acc.set(key, idx + ROW_OFFSET)
            return acc
        }, new Map<string, number>());

        const availabilities = getTeamAvailabilities(team.id)
            .sort(availabilitiesComparator);

        const aoa: any[][] = Array(teamMembers.length + ROW_OFFSET);

        for (let i = 0; i < aoa.length; i++) {
            aoa[i] = new Array(availabilities.length - 1);
        }

        teamMembers.forEach((member, index) => {
            aoa[index+ROW_OFFSET][0] = typeof member === "string" ?
                member : `${member.firstName} ${member.lastName}`;
        });


        availabilities.forEach((availability, index) => {
            const column = index + 1;
            const date = new Date(availability.date);

            const [opponent, type] = availability.matchInfo !== undefined ?
                [availability.matchInfo.opponentName, availability.matchInfo.type] :
                [availability.heading, undefined];

            function setStatus(status: string, ids: string[]) {
                ids.forEach((id) => {
                    const rowIndex = rowIndexById.get(id)!;
                    aoa[rowIndex][column] = status;
                })
            }

            aoa[0][column] = date;
            aoa[1][column] = opponent;
            if (type !== undefined) aoa[2][column] = type;

            setStatus("ACCEPTED", availability.acceptedIds);
            setStatus("DECLINED", availability.declinedIds);
            setStatus("UNANSWERED", availability.unansweredIds);
            setStatus("UNCONFIRMED", availability.unconfirmedIds);
            setStatus("WAITLIST", availability.waitingListIds);
        })

        const worksheet = XLSX.utils.aoa_to_sheet(aoa);

        const cols: any[] = new Array(availabilities.length + 1)
        for (let i = 0; i < availabilities.length + 1; i++) {
            const width = aoa.reduce((width, row) => {
                if (typeof row[i] === "string") {
                    return Math.max(width, row[i].length);
                }
                return width;
            }, 10);
            cols[i] = {wch: width + 1};
        }

        worksheet["!cols"] = cols;
        XLSX.utils.book_append_sheet(workbook, worksheet, team.name);
    }

    return workbook;
}

export function saveWorkbook(filename: string) {
    const workbook = createWorkbook();
    XLSX.writeFile(workbook, filename, {type: "file", bookType: "xlsx"})
}