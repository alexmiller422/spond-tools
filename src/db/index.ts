export type Member = {
    id: string,
    firstName: string,
    lastName: string
}

export type Team = {
    id: string,
    name: string
}

export type MatchAvailabilities = {
    matchId: string,
    subgroupId: string,
    heading: string,
    matchInfo?: {
        teamName: string,
        opponentName: string,
        type: string,
    }
    date: string,
    acceptedIds: string[],
    declinedIds: string[],
    unansweredIds: string[],
    waitingListIds: string[],
    unconfirmedIds: string[]
}

const teamsById: Map<string, Team> = new Map<string, Team>();

const membersById: Map<string, Member> = new Map<string, Member>();
const membersByTeam: Map<string, Set<string>> = new Map<string, Set<string>>();

export function upsertTeam(team: Team, teamMembers: (Member | string)[]) {
    teamsById.set(team.id, team);
    if (!membersByTeam.has(team.id)) {
        membersByTeam.set(team.id, new Set<string>());
    }
    for (const member of teamMembers) {
        if (typeof member === 'string') {
            membersByTeam.get(team.id)!.add(member);
        }
        else {
            membersById.set(member.id, member);
            membersByTeam.get(team.id)!.add(member.id);
        }
    }
}

export function getTeams(): Team[] {
    return Array.from(teamsById.values());
}

export function getTeamMembers(teamId: string): (Member | string)[] {
    return Array.from(membersByTeam.get(teamId)!.values()).map((memberId) => {
        if (membersById.has(memberId)) {
            return membersById.get(memberId)!;
        }
        return memberId;
    });
}

const availabilitiesByTeam: Map<string, Map<string, MatchAvailabilities>> = new Map<string, Map<string, MatchAvailabilities>>();

export function upsertAvailabilities(team: Team, availabilities: MatchAvailabilities) {
    if (!availabilitiesByTeam.has(team.id)) {
        availabilitiesByTeam.set(team.id, new Map<string, MatchAvailabilities>());
    }

    availabilitiesByTeam.get(team.id)!.set(availabilities.matchId, availabilities);
}

export function getTeamAvailabilities(teamId: string) {
    return Array.from(availabilitiesByTeam.get(teamId)!.values());
}