import {Page} from "playwright";

export interface Group {
    scrollAllEvents(): Promise<this>;
}

class GroupImpl implements Group {
    constructor(public readonly name: string, private page: Page) {
    }

    public async scrollAllEvents(): Promise<this> {
        let initialCount: number;
        let afterScrollCount: number;
        do {
            const locator = this.page.locator("#pageContentWrapper")
                .filter({hasText: "Edit Events"})
                .locator("> div > div:nth-child(2)")

            initialCount = await locator.locator("> div").count();

            const spinnerPromise = this.page.locator("#spinner").waitFor();
            await locator.locator("> div:last-child").scrollIntoViewIfNeeded();
            await spinnerPromise.then(() => {
                    return this.page.locator("#spinner").waitFor({state: "detached"});
                });

            afterScrollCount = await locator.locator("> div").count();
        } while (afterScrollCount > initialCount);

        return this;
    }
}

export interface Client {
    navigateToGroup(group: string): Promise<Group>
}

class ClientImpl implements Client{
    constructor(private readonly page: Page) {
    }

    public async navigateToGroup(group: string): Promise<Group> {
        await this.page.getByRole("list")
            .filter({hasText: "Groups"})
            .getByRole("listitem")
            .filter({hasText: group})
            .click();
        await this.page.waitForURL("https://spond.com/client/groups/*");

        return new GroupImpl(group, this.page);
    }

}

export async function login(page: Page, emailOrPhoneNumber: string, password: string): Promise<Client> {
    await page.goto("https://spond.com/client");

    await page.locator("//input[@name='emailOrPhoneNumber']")
        .fill(emailOrPhoneNumber);

    await page.locator("//input[@name='password']")
        .fill(password);

    await page.getByRole("button", { name: "Sign in" })
        .click();

    await page.waitForURL("https://spond.com/client");

    return new ClientImpl(page);
}