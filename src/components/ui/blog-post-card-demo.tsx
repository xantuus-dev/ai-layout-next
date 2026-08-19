import { ArticleCard } from "@/components/ui/blog-post-card";

export default function BlogPostCardDemo() {
  return (
    <div className="flex w-full justify-center p-6 bg-background">
      <ArticleCard
        headline="Shaping Tomorrow: AI & The Web"
        excerpt="From automated coding assistants to intelligent design workflows, AI is redefining how developers build and ship modern applications."
        cover="https://framerusercontent.com/images/HeBZhwOVxQyFU36pkfQyEMExIOg.png?width=8192&height=4608"
        tag="Innovation"
        readingTime={420}
        writer="John Doe"
        publishedAt={new Date("2025-09-01")}
      />
    </div>
  );
}
