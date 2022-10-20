## DbSyncProvider

The `DbSyncProvider`
[source code](https://github.com/input-output-hk/cardano-js-sdk/blob/master/packages/cardano-services/src/DbSyncProvider.ts).

From the need to have some `Provider`s implementing both `DbSyncProvider` and `RunnableModule`
interfaces and some other `Provider`s implementing only `DbSyncProvider` interface, we implemented
the `DbSyncProvider` as a [mixin](https://www.typescriptlang.org/docs/handbook/mixins.html).

To support the development of this `class`
[this playground](https://www.typescriptlang.org/play?#code/C4TwDgpgBAEhCGAbYALAwiiBjA1gJQgGcwB7AO0OgF4oBvAWACgooScAuKAIxJMQTIBuJi0QksSAHIkAJhAD8nAK5kcZEgHchTAL7DGTAJZlgEAE4AzeFmgAFMyQBuhuWboiomJKgzYcACgBKTnsSAFtDSgAeOG90TFwCYnJKAD59HSYjMNIzYDooW15EKB0oCwcwqAByMABzav0mLBT8mABRAEEAGQAVGAB9NA60AGkBgEUAVXa8AE0oGmqAZXbu9rReqABGRqzGUEgoTrIQTrM6wkWoeFOAbQBdJsYIAA9c-JaKfIARLmWQGQsKFnK5rlEPFs3qYyDIrv54FxCMAzNZ8mQIBooP4AHR4+AXQicE5nQmBRapOg6ckAH2xGKxuPxhOJp3Ol3JVEptGp11oUAZ2OCVNKTFS-g8ACF4JQ0IgZYRFFBekxOdyPIjkaisJ95YQrgBZQyvYxQaEQWHw6WyvVXGl0gDyXAAVthgOTDDl+GELcAriCXOZ3MwWFAwEouIhDFgoDIuCFis9Q1AvlqlDqSGYmTiCZdWaSOcHkyxU-k7nGADRQPE4rgyiDswgPa53Gu5ptJ4uEJSQLM1uuURuBTvJ1CRHFx65x-TJzIGEMscOR6M3QiAmNeZDxPxBEKVSIQGIILe+RJEUgUCDqheh0tQMxEJTIa7wDTwQz5MeECdcHEARyUcwQH8Doen6IYRnGaZZjmYcPGTB9gCUMwyAKNhOAAQgwh9u2QHEHA0NASBUfI9Hg0UQznDxDmga0G0Ja4oVeGE4RuJEUTRAVMWxft60bThjAsINOjVKlyPkY5yM4JiWKuQVswHei8ygQThNEnlxMkm9OAxRxzBnKAaKgOiAElvluGxGLNZiLVYzUOJ1LjGV4wcWWONkyQpFSyCEtwTM0-ztOVazZKcni8UU-j3ILQhRNUvyAqkri9LMAyjIIJCUIgGRenAahjPrMzkQs6AADICjjBM+EETxjx8BIOCFLzQgiaJYhPBqkgvNJSk7RDkNQo0TVQmUoBUNRNBG+EZNsuTuIUvi3JJIcvI0m8JPkyrCmKKs2zcuiVq5KAMoG7LcsgJL7O1dF5q2oo+F25llIOzyjpOrKcry8lyoYG8wAcYASBozh+U3eq-E4IJmv3Nq6u3M9kkvSkyMojJnjeD5DLyqA-gBIEA1cKJekpGgZstMLs3bfNDspeKoAdKAJIZnSIBS54ZXXJqjt+ktbWVIhgDlBUi1vVozHTQGs1MZEdKUMIuHMKssAazgtWMOpyR54tUz4CAcTEOp-GVvwoAAakMgW4JvKib2l4B-Dt1WUXVzXyJYfqUIt5EDJYOdff2Fgrs4rA+c6djrqF-URZLMWJczB2Badsx1aVlWBTlhWzFdm8Y4oXX9ZIQ27bNlMGqt2cA9DIPHLthOZagNWyA1pP1YMm3c+RWMuGuMgnxKUbxvULRV226rK7vXoBYJ8xtmuXH12nrNy6xo5J+RRfZ5oef8YcUFzCiGiSAsfn193wMzG2dJx9aL3gA3nvuLXu+z9cbZ-DjZe7ztzebjfD9b43jiMG8MAhWw8BPKeL9zAACY57-AXlArMT9I6xTStjJ+i9YFb3gTvJw58D55SPifZ+eDXDQKvvODun5IGkJgQ-LEGDEHQPflwKs0CADMVZqh22qJ-G+dssFQDuK+d81DT60LMNAoBcNTygKrHbTBOJa7cIFrw5so1SydhDsLRhEj2EhVmjjHBwJEH+GQbabOyZja4CNmnXu8tzCWOLB7VC1icA+wov7ShKZ+E0L3mYfRNBBS6P8ewlhbDOE1B4Xw74t9AlCJEf-BRiD2HSLiLIoI8i-Hn1Sco6JWTxGhJxG4-wHDAjqKuJo6+sS6IhPPgAFjgXjExEj-Bhy1GiFBYCQwAHoelQCmECcIPoTCGRQJEQyJAoB1AgPkeAPiciGH4GaMwDgzAeD6VANAtx1CfAfPAUwNxULGGKkCaARDbhsQ6Y5bR+oNn9LvIpOprhGlBO4rU7JLyghaL5s88wjTzTkw+YUhp0coCbKImEEZn5xlXEBtM2ZNwFlgCWUGcwazyKbOkGQAAtNXXUwtqh-LMPU6osYSBEAFEDFSXoIDQu8pgZOpgZBXIcvkH0Di3AqORGSio4QUx82qO9DEn1IDVHIrXR2DdnZN2FI3OoBQXG3xqn7Ci4DfEgpefQ4hi96nhKiaoiJMTO521eQkv+YiSH+PqWkjqO5AgFKtQ0pRAt-DcuAGokeVTvE634AXIuAttiOugY6yJpqrYoyAA)
could be useful to interactively _mouse hover_ types and variables to have a quick feedback about
them.