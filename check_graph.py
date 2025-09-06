"""Check knowledge graph status and test search."""

import asyncio
import os
from dotenv import load_dotenv
from agent.db_utils import db_pool, search_facts

load_dotenv()

async def check_graph():
    """Check graph database status."""
    try:
        async with db_pool.acquire() as conn:
            # Check table counts
            facts_count = await conn.fetchval("SELECT COUNT(*) FROM facts")
            nodes_count = await conn.fetchval("SELECT COUNT(*) FROM nodes")
            edges_count = await conn.fetchval("SELECT COUNT(*) FROM edges")
            
            print(f"Graph Database Status:")
            print(f"  Facts: {facts_count}")
            print(f"  Nodes: {nodes_count}")
            print(f"  Edges: {edges_count}")
            
            # Test search if we have facts
            if facts_count > 0:
                print("\nTesting graph search...")
                results = await search_facts("contamination", limit=5)
                print(f"Found {len(results)} results for 'contamination'")
                for r in results[:3]:
                    print(f"  - {r['content'][:100]}...")
            else:
                print("\n⚠️ No facts in knowledge graph!")
                print("The graph needs to be populated with data.")
                
            # Check if we have documents that could be used to populate graph
            doc_count = await conn.fetchval("SELECT COUNT(*) FROM documents")
            chunk_count = await conn.fetchval("SELECT COUNT(*) FROM chunks")
            print(f"\nDocument Status:")
            print(f"  Documents: {doc_count}")
            print(f"  Chunks: {chunk_count}")
            
            if chunk_count > 0 and facts_count == 0:
                print("\n💡 You have documents but no graph data.")
                print("The knowledge graph needs to be built from your documents.")
                print("This usually happens during document ingestion with graph extraction enabled.")
                
    except Exception as e:
        print(f"Error checking graph: {e}")
    finally:
        await db_pool.close()

if __name__ == "__main__":
    asyncio.run(check_graph())
