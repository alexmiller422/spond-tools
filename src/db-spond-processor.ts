import {MatchAvailabilities, Member, Team, upsertAvailabilities, upsertTeam} from "./db";

export async function processSpond(match: any) {
    const subGroups: any[] = match.recipients?.group?.subGroups;
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
            matchAvailabilities.matchInfo = {
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