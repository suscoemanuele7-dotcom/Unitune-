import { describe, expect, it } from 'vitest'
import { displayInfo, formatDuration } from './trackDisplay'

describe('displayInfo', () => {
  it.each([
    ['Rick Astley - Never Gonna Give You Up (Official Video)', 'Rick Astley', 'Never Gonna Give You Up', 'Rick Astley'],
    ['Queen – Bohemian Rhapsody (Official Video Remastered)', 'Queen Official', 'Bohemian Rhapsody', 'Queen'],
    ['Numb (Official Music Video) [4K UPGRADE] – Linkin Park', 'Linkin Park', 'Numb', 'Linkin Park'],
    ['Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars', 'Mark Ronson', 'Uptown Funk ft. Bruno Mars', 'Mark Ronson'],
    ['Alan Walker - Faded', 'Alan Walker', 'Faded', 'Alan Walker'],
    ['Bella ciao', 'ArtistaVEVO', 'Bella ciao', 'Artista'],
    ['Song title', 'Band - Topic', 'Song title', 'Band'],
    ['Waka Waka (This Time for Africa)', 'Shakira', 'Waka Waka (This Time for Africa)', 'Shakira'],
  ])('"%s"', (title, channelTitle, expectedTitle, expectedArtist) => {
    expect(displayInfo({ title, channelTitle })).toEqual({ title: expectedTitle, artist: expectedArtist })
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [213, '3:33'],
    [3723, '1:02:03'],
    [null, '--:--'],
    [Number.NaN, '--:--'],
  ])('%s → %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected)
  })
})
