import {Member} from "./db";


export function memberComparator(member1: Member | string, member2: Member | string){
    if (typeof member1 === "string" && typeof member2 === "string") {
        return member1.localeCompare(member2);
    }

    if (typeof member1 === "string") {
        return 1;
    }

    if (typeof member2 === "string") {
        return -1;
    }
    const firstName = member1.firstName.localeCompare(member2.firstName)

    if (firstName != 0) {
        return firstName;
    }

    return member1.lastName.localeCompare(member2.lastName);
}