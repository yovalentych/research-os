# Data Model (Draft)

## Access model
- Global roles: Owner, Supervisor, Mentor, Collaborator, Viewer.
- Supervisor/Mentor мають доступ до всіх проектів, але Owner залишається єдиним власником.
- Проєктні ролі застосовуються для запрошених користувачів.
- Всі зміни логуються у audit_logs + field_versions.

## Core collections

### users
- _id
- email
- passwordHash
- fullName
- globalRole: Owner | Supervisor | Mentor | Collaborator | Viewer
- createdAt, updatedAt

### projects
- _id
- ownerId
- title
- description
- status
- tags[]
- visibility: private | shared
- createdAt, updatedAt

### memberships
- _id
- projectId
- userId
- role: Collaborator | Viewer
- invitedBy
- createdAt, updatedAt

### experiments
- _id
- projectId
- title
- status
- protocol: { version, checklist[], steps[] }
- plan: { steps[], deadlines[], dependencies[] }
- results: { metrics[], figures[], conclusion }
- quality: { issues, nextTime }
- links: { papers[], tasks[], collaborations[], materials[] }
- createdAt, updatedAt

### tasks
- _id
- projectId
- title
- description
- status
- priority
- dependencies[]
- dueDate
- createdAt, updatedAt

### files
- _id
- projectId
- entityType
- entityId
- name
- mimeType
- size
- storage: { bucket, key, url }
- version
- tags[]
- createdAt, updatedAt

### notes
- _id
- projectId
- title
- body
- tags[]
- linkedEntities[]
- createdAt, updatedAt

### sources
- _id
- projectId
- title
- authors[]
- year
- journal
- doi
- url
- pdfFileId
- tags[]
- createdAt, updatedAt

### protocols
- _id
- projectId
- title
- template
- parameters
- version
- createdAt, updatedAt

### papers
- _id
- projectId
- title
- status
- figures[]
- manuscriptBlocks[]
- checklist[]
- targetJournals[]
- createdAt, updatedAt

### inventory_items
- _id
- projectId
- name
- type
- supplier
- lot
- quantity
- unit
- storageLocation
- expiryDate
- createdAt, updatedAt

### finance_entries
- _id
- projectId
- category
- amount
- currency
- vendor
- date
- notes
- createdAt, updatedAt

### dissertation_blocks
- _id
- projectId
- section: intro | methods | results | discussion | appendix
- content
- linkedExperiments[]
- linkedFigures[]
- createdAt, updatedAt

## Audit & versioning

### audit_logs
- _id
- actorId
- action: create | update | delete
- entityType
- entityId
- projectId
- timestamp
- metadata: { ip, userAgent }

### field_versions
- _id
- entityType
- entityId
- fieldPath
- oldValue
- newValue
- changedBy
- changedAt
