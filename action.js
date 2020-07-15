const _ = require('lodash')
const Jira = require('./common/net/Jira')

module.exports = class {
  constructor ({ githubEvent, argv, config }) {
    this.Jira = new Jira({
      baseUrl: config.baseUrl,
      token: config.token,
      email: config.email,
    })

    this.config = config
    this.argv = argv
    this.githubEvent = githubEvent
  }

  async execute () {
    const { argv } = this

    const issueId = argv.issue

    const origIssue = await this.Jira.getIssue(issueId, {fields: ["project"]})
    const projectId = _.get(origIssue, 'fields.project.id')
    
    if (argv.fixVersion != undefined && argv.fixVersion != "") {
      const versions = await this.Jira.getProjectVersions(projectId)
      let versionToApply = _.find(versions, (v) => {
        if (v.name.toLowerCase() === argv.fixVersion.toLowerCase()) return true
      })
      if (versionToApply) {
        console.log("Version found.")
      }
      else {
        console.log("Version not found, creating a new one.")
        versionToApply = await this.Jira.createVersion({
            archived: false,
            name: argv.fixVersion,
            projectId: projectId,
            released: false
        })
      }
    }

    const { transitions } = await this.Jira.getIssueTransitions(issueId)

    const transitionToApply = _.find(transitions, (t) => {
      if (t.id === argv.transitionId) return true
      if (t.name.toLowerCase() === argv.transition.toLowerCase()) return true
    })

    if (!transitionToApply) {
      console.log('Please specify transition name or transition id.')
      console.log('Possible transitions:')
      transitions.forEach((t) => {
        console.log(`{ id: ${t.id}, name: ${t.name} } transitions issue to '${t.to.name}' status.`)
      })

      return
    }

    console.log(`Selected transition:${JSON.stringify(transitionToApply, null, 4)}`)

    let updatePayload = null
    if (argv.fixVersion != undefined && argv.fixVersion != "") {
      updatePayload = { 
        update: {
          fixVersions: [
            {
              add: {
                name: argv.fixVersion
              }
            }
          ]
        }
      }
    }

    await this.Jira.transitionIssue(issueId, Object.assign({
        transition: {
          id: transitionToApply.id,
        }
      },
      updatePayload))

    const transitionedIssue = await this.Jira.getIssue(issueId)

    // console.log(`transitionedIssue:${JSON.stringify(transitionedIssue, null, 4)}`)
    console.log(`Changed ${issueId} status to : ${_.get(transitionedIssue, 'fields.status.name')} .`)
    console.log(`Link to issue: ${this.config.baseUrl}/browse/${issueId}`)

    return {}
  }
}
