import {chromium, Page, Response} from "playwright";
import {loggerFactory} from "../logging";

const LOG = loggerFactory({module: "scraper"});

interface Group {
    scrollAllEvents(): Promise<this>;
}

class GroupImpl implements Group {
    constructor(public readonly name: string, private page: Page) {
    }

    public async scrollAllEvents(): Promise<this> {
        let initialCount: number;
        let afterScrollCount: number;

        const locator = this.page.locator("#pageContentWrapper")
            .filter({hasText: "Edit Events"})
            .locator("> div > div:nth-child(2)")

        try {
            await this.page.locator("#spinner").waitFor();
            await this.page.locator("#spinner").waitFor({state: "detached"});
        }
        catch(error) {
            console.log(error);
        }
        do {
            LOG.info("Scrolling Sponds");

            initialCount = await locator.locator("> div").count();

            const spinnerPromise = this.page.locator("#spinner").waitFor()
                .then(() => {
                    return this.page.locator("#spinner").waitFor({state: "detached"});
                });

            await locator.locator("> div:last-child").scrollIntoViewIfNeeded();
            await spinnerPromise

            afterScrollCount = await locator.locator("> div").count();

            LOG.info("New Sponds = %d - %d", initialCount, afterScrollCount);
        } while (afterScrollCount > initialCount);

        return this;
    }
}

interface Client {
    navigateToGroup(group: string): Promise<Group>
}

class ClientImpl implements Client{
    constructor(private readonly page: Page) {
    }

    public async navigateToGroup(group: string): Promise<Group> {
        LOG.info("Navigating to group, %s", group);

        await this.page.getByRole("list")
            .filter({hasText: "Groups"})
            .getByRole("listitem")
            .filter({hasText: group})
            .click();

        await this.page.waitForURL("https://spond.com/client/groups/*");

        LOG.info("Navigated to group, %s", group);
        return new GroupImpl(group, this.page);
    }

}

async function login(page: Page, emailOrPhoneNumber: string, password: string): Promise<Client> {
    LOG.info("Logging in to Spond");

    await page.goto("https://spond.com/client");

    await page.locator("//input[@name='emailOrPhoneNumber']")
        .fill(emailOrPhoneNumber);

    await page.locator("//input[@name='password']")
        .fill(password);

    await page.getByRole("button", { name: "Sign in" })
        .click();

    await page.waitForURL("https://spond.com/client");

    LOG.info("Log in to Spond complete");
    return new ClientImpl(page);
}

function responseHandler(spondHandler: (sponds: any) => Promise<void>) {
    return (response: Response) => {
        if (response.request().method() === "GET" && response.request().url().includes('/sponds') && response.status() == 200) {
            response.json().then(async (sponds: any[]) => {
                LOG.info("Processing Sponds");
                try {
                    for (const spond of sponds) {
                        await spondHandler(spond);
                    }
                    LOG.info("Processed Sponds");
                }
                catch(error) {
                    LOG.error(error,"Error processing Sponds");
                }
            })
        }
    }
}

const PLAYWRIGHT_DEFAULT_TIMEOUT = process.env.PLAYWRIGHT_DEFAULT_TIMEOUT ? parseInt(process.env.PLAYWRIGHT_DEFAULT_TIMEOUT) : 450000;

export async function scrape(
    headless: boolean, trace: boolean, emailOrPhoneNumber: string, password: string, groupName: string, spondHandler: (spond: any[]) => Promise<void>
) {
    const browser = await chromium.launch({headless});
    const context = await browser.newContext();
    context.setDefaultTimeout(PLAYWRIGHT_DEFAULT_TIMEOUT);
    if (trace) {
        await context.tracing.start({screenshots: true, snapshots: true});
    }
    const page = await context.newPage();
    page.on('response', responseHandler(spondHandler));


    const client = await login(page, emailOrPhoneNumber, password);

    const group = await client.navigateToGroup(groupName);
    await group.scrollAllEvents();

    await page.close();
    if (trace) {
        await context.tracing.stop({path: "trace.zip"});
    }
    await browser.close();
}
