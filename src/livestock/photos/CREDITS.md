# Coop photo credits

One real photo for each coop in Animals → Coop (`src/livestock/photos.ts`), from Wikimedia Commons. Each is cropped to
10:7 and saved as WebP (80 KB or less); the game shows the author and licence on the photo. Full records are in
`credits.json`.

| Coop | Photo | Author | Licence |
|---|---|---|---|
| Night shelter (`coop/shelter`) | [Chicken and chicken house, Southeast Sénégal](https://commons.wikimedia.org/wiki/File:Chicken_and_chicken_house,_Southeast_S%C3%A9n%C3%A9gal_(West_Africa)_(582535142).jpg) | John Atherton | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| Simple coop (`coop/basic`) | [Chicken house super in Bbamba Kasangati](https://commons.wikimedia.org/wiki/File:Chicken_house_super_in_Bbamba_Kasangati.jpg) (Uganda) | MEvalyn | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Movable coop (`coop/mobile`) | [Partners Makutu and his chicken tractor](https://commons.wikimedia.org/wiki/File:Partners_Makutu_and_his_chicken_tractor.jpg) | Guy Stubbs | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Raised coop with wire mesh (`coop/secure`) | [A local chicken house](https://commons.wikimedia.org/wiki/File:A_local_chicken_house.jpg) | Eja Thomas Festo | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Layer house (`coop/layers`) | [Chicken house front view in Bbamba Kasangati](https://commons.wikimedia.org/wiki/File:Chicken_house_front_view_in_Bbamba_Kasangati.jpg) (Uganda) | MEvalyn | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |

To add or change one: save it as `coop/<coop id>.webp`, add its entry to `credits.json` and a row here, then run
`python3 scripts/lite-photos.py` for its Data saver copy.
