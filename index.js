const core = require('@actions/core')
const github = require('@actions/github')

async function main() {
    const token = core.getInput('TOKEN', {required: true, trimWhitespace: true})
    const org = core.getInput('ORG', {required: true, trimWhitespace: true})

    let auditLog
    core.info(`Fetching audit log for ${org}`)
    const client = await github.getOctokit(token)
    try {
        auditLog = await client.rest.paginate('GET /orgs/{org}/audit-log', {
            org: org,
            phrase: 'action:team.remove_member',
            include: 'all',
            per_page: 100
        })
    } catch (e) {
        core.error(`Unable to fetch audit log: ${e}`)
        core.setFailed(`Failed fetching audit log`)
    }

    let found = false
    for (const entry of auditLog) {
        if (entry.user === process.env.USER && entry.actor === 'va-devops-bot') {
            if(!found) {
                found = true
            }
            core.info(`Attempting to reinstate ${entry.user} to the ${entry.team} team`)
            try {
                await client.rest.teams.addOrUpdateMembershipForUserInOrg({
                    org: org,
                    username: entry.user,
                    role: "member",
                    team_slug: entry.team.split('/')[1]
                })
                core.info(`Successfully added ${entry.user} to the ${entry.team} team`)
            } catch (e) {
                core.error(`Unable to add ${entry.user} to ${entry.team}: ${e.message}`)
                core.setFailed(`Failed adding user to one or more teams`)
            }
        }
    }
    if(!found) {
        core.warning(`No entries for ${process.env.USER} were found in the audit log in the last 90 days`)
        core.setFailed('User not found, perhaps they were removed more than 90 days ago')
    }
}

main()
