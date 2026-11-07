import asyncio

from gigsaw_ai.database.chroma import InMemoryPortfolioStore


def test_portfolio_store_add_search_update_delete():
    store = InMemoryPortfolioStore()
    asyncio.run(store.upsert("f1", "Restaurant food photography and menu styling"))
    assert asyncio.run(store.search("food photography"))[0][0] == "f1"
    asyncio.run(store.upsert("f1", "Fast responsive website development"))
    assert asyncio.run(store.search("website"))[0][1] > 0
    asyncio.run(store.delete("f1"))
    assert asyncio.run(store.search("website")) == []
