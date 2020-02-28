import { QuantelAgent } from '../agents/quantel/quantel-agent.js'
import { createQuantelClipNcsItem } from '../mos/ncsItemCreator.js'
import { getSelected } from '../state.js'

export { init }

const classNames = {
	CLIP_LIST: 'clips',
	CLIP_ITEM: 'clip'
}

const dataAttributeNames = {
	CLIP: 'clip',
	GUID: 'guid'
}

/**
 * Performs a search on the Quantel Server using the query parameters from
 * the request querystring and creates a list of the items found.
 *
 * Sets up event listeneres for user interaction with the list, and calls
 * the given callbacks provided.
 *
 * @param {object} callbacks
 * @param {function} callbacks.onTargetSelect - called when user selects a clip
 * @param {function} callbacks.onTargetCancel - called when the user cancels a clip selection
 */
async function init({ onTargetSelect, onTargetCancel }) {
	const params = new URLSearchParams(document.location.search.substring(1))
	const server = params.get('server') || document.location.origin + '/api'
	const titleQuery = params.get('title')
	const poolIdQuery = params.get('poolId')
	const createdQuery = params.get('created')

	const origin = params.get('origin')
	if (origin) {
		let originURL
		try {
			originURL = new URL(origin)
			document.domain = originURL.hostname
		} catch (e) {
			if (e.name === 'SecurityError' && originURL) {
				console.error(`Could not change document domain to "${originURL.hostname}" for provided origin URL: "${origin}"`, e)
			} else if (e.name === 'TypeError') {
				console.error(`Invalid origin URL: "${origin}"`, e)
			} else {
				console.error(e)
			}
		}
	}

	performSearch(
		{
			server,
			query: { title: titleQuery, poolId: poolIdQuery, created: createdQuery }
		},
		10000
	)

	setupDragTracking(classNames.CLIP_ITEM, {
		onDragStart: (clipItem, dataTransfer) => {
			try {
				const clipData = clipItem.dataset[dataAttributeNames.CLIP]
				if (clipData) {
					const clip = JSON.parse(clipData)
					onTargetSelect(clip)

					const ncsItem = createQuantelClipNcsItem(clip)
					dataTransfer.setData('text', new XMLSerializer().serializeToString(ncsItem))
				}
			} catch (error) {
				console.error('Error while selecting clip', error)
			}
		},
		onDragEnd: (clipItem) => {
			const guid = clipItem.dataset[dataAttributeNames.GUID]
			if (guid) {
				onTargetCancel()
			}
		}
	})

	return {
		origin
	}
}

function setupDragTracking(className, { onDragStart, onDragEnd }) {
	document.addEventListener('dragstart', ({ target, dataTransfer }) => {
		if (target.classList.contains(className)) {
			onDragStart(target, dataTransfer)
		}
	})

	document.addEventListener('dragend', ({ target }) => {
		if (target.classList.contains(className)) {
			onDragEnd(target)
		}
	})
}

function rebuildClipList(clips) {
	const newClipList = buildClipList(clips)
	const oldClipList = document.querySelector(`.${classNames.CLIP_LIST}`)
	if (oldClipList) {
		oldClipList.parentElement.replaceChild(newClipList, oldClipList)
	} else {
		document.body.appendChild(newClipList)
	}
}

function buildClipList(clips) {
	const clipList = document.createElement('ol')
	clipList.classList.add(classNames.CLIP_LIST)
	clips.forEach((clip) => {
		const clipListelement = createClipListElement(clip)
		clipList.appendChild(clipListelement)
	})
	return clipList
}

async function performSearch({ server, query }, refreshAfter) {
	const quantelAgent = new QuantelAgent(server)
	const result = await quantelAgent.searchClip({ title: query.title })

	rebuildClipList(result.clips)

	if (!Number.isNaN(Number(refreshAfter)) && refreshAfter > 0) {
		setTimeout(performSearch, refreshAfter, { server, query }, refreshAfter)
	}
}

function createClipListElement(clip) {
	const listItem = document.createElement('li')

	listItem.setAttribute('draggable', true)
	listItem.classList.add(classNames.CLIP_ITEM)
	listItem.dataset[dataAttributeNames.GUID] = clip.guid
	listItem.dataset[dataAttributeNames.CLIP] = JSON.stringify(clip)

	const thumbnail = document.createElement('img')
	thumbnail.src = clip.thumbnailUrl
	thumbnail.setAttribute('alt', `Still frame for ${clip.title}`)
	listItem.appendChild(thumbnail)

	const label = document.createElement('span')
	label.textContent = clip.title
	listItem.appendChild(label)

	return listItem
}
