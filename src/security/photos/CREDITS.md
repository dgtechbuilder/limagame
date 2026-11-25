# Security photo credits

One real photo for each measure in Security → Protect (`src/security/photos.ts`), so a player sees what they are buying.
All are openly licensed (CC BY, CC BY-SA or public domain), found through Openverse on Flickr and Wikimedia Commons.
Each is cropped to 10:7 and saved as WebP (80 KB or less); the card shows the author and licence on the photo. Full
records are in `credits.json`.

| Measure | Photo | Author | Licence |
|---|---|---|---|
| Join the community watch (`watch`) | [Maasai women in community dialogue on financial empowerment in Kajiado County, Kenya](https://commons.wikimedia.org/wiki/File:Maasai_women_in_community_dialogue_on_financial_empowerment_in_Kajiado_County,_Kenya.jpg) (Wikimedia Commons) | Mark Myles Mugambi | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Padlocks on the shed and the store (`locks`) | [Green Door](https://www.flickr.com/photos/27452744@N08/3104979764) (Flickr) | gill.holgate | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Night watchman (`watchman`) | [Meredith with the askaris](https://www.flickr.com/photos/18288598@N00/3802267894) (Flickr) | whiteafrican | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Mobile money, not cash (`mpesa`) | [M-PESA agent in Kibera, Nairobi, Kenya](https://www.flickr.com/photos/134037448@N03/33322696760) (Flickr) | wrcomms | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| A lock on the tank’s tap (`taplock`) | [Precious Resource](https://www.flickr.com/photos/8510225@N07/8331583191) (Flickr) | John Loo | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Brand and ear-tag the cows (`tags`) | [Curious Cows](https://www.flickr.com/photos/23206546@N04/8339433181) (Flickr) | Rusty Clark ~ 100K Photos | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Guard dog (`dog`) | [Friends, Ethiopia](https://www.flickr.com/photos/64607715@N05/8008477122) (Flickr) | Rod Waddington | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| Solar security light (`light`) | [Project 365 #354: 201214 The Lighthouse Keeper](https://www.flickr.com/photos/23408922@N07/15877596410) (Flickr) | comedy_nose | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) |
| Fence and a locked gate (`fence`) | [Climate smart agriculture adoption in Machakos county](https://www.flickr.com/photos/55227776@N04/15019482223) (Flickr) | CGIAR Climate | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| GPS tracker and a locking fuel cap (`gps`) | [The Crew](https://www.flickr.com/photos/23401669@N00/7631425686) (Flickr) | Son of Groucho | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |

To add or change one: save it as `<measure id>.webp` (the ids are in `src/security/config.ts`), add its entry to
`credits.json` and a row here, then run `python3 scripts/lite-photos.py` for its Data saver copy.
