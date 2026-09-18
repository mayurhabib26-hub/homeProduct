import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { type ApiRecipe } from '@sv/shared';
import { useRecipes, useProducts } from '../api/queries';
import { ErrorState, EmptyState } from '../components/QueryStates';
import {Recipe, formatPaise } from '@sv/shared';

import { Clock, ChefHat, Users, ArrowRight, ShoppingBag, Check, X, Sparkles } from 'lucide-react';
import { ScrollReveal } from '../components/ScrollReveal';

export const RecipesPage: React.FC = () => {
  const { addToCart } = useShop();
  const { slug: selectedRecipeId } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: recipeData, isError, error, refetch } = useRecipes();
  const { data: catalogue } = useProducts({ limit: 60 });
  const recipes = recipeData ?? [];
  const allProducts = catalogue?.data ?? [];
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [checkedIngredients, setCheckedIngredients] = useState<{ [key: string]: boolean }>({});

  const selectedRecipe = recipes.find((r) => r.slug === selectedRecipeId);

  const filteredRecipes = recipes.filter((r) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'quick') return parseInt(r.prepTime) <= 20;
    if (activeFilter === 'classics') return r.slug.includes('rasam') || r.slug.includes('sambar') || r.slug.includes('puliyogare');
    if (activeFilter === 'breakfast') return r.slug.includes('idli') || r.slug.includes('rice');
    return true;
  });

  const toggleIngredientCheck = (ing: string) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [ing]: !prev[ing],
    }));
  };

  const getProductForRecipe = (recipe: ApiRecipe) => {
    return allProducts.find((p) => p.slug === recipe.pairedProductSlug);
  };

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-10 md:py-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <ScrollReveal animation="fade-up">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
              FAMILY KITCHEN NOTEBOOK
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
              TRADITIONAL RECIPES
            </h1>
            <p className="text-sm sm:text-base text-[#483828]/80 leading-relaxed font-sans">
              Bring comforting temple-style and home-cooked aromas to your kitchen with tested, step-by-step South Indian guides.
            </p>
          </div>
        </ScrollReveal>

        {/* Filter Tabs */}
        <ScrollReveal animation="fade-up" delay={0.05}>
          <div className="flex justify-center items-center gap-2 mb-10 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Recipes' },
              { id: 'classics', label: 'Heritage Classics' },
              { id: 'quick', label: 'Under 20 Mins' },
              { id: 'breakfast', label: 'Breakfast & Tiffin' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-[#87380F] text-white shadow-xs'
                    : 'bg-white border border-[#EBD9BC] text-[#483828] hover:border-[#87380F]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {/* Recipes Magazine Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {filteredRecipes.map((recipe, idx) => {
            const relatedProduct = getProductForRecipe(recipe);
            return (
              <ScrollReveal key={recipe.slug} animation="fade-up" delay={Math.min(idx * 0.08, 0.25)}>
                <div
                  className="group bg-white rounded-2xl overflow-hidden border border-[#EBD9BC] hover:border-[#B69A55] transition-all duration-300 shadow-xs hover:shadow-md flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#F3E7D0]">
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute top-3 right-3 bg-[#FAF6F0]/95 backdrop-blur-xs px-2.5 py-1 rounded text-[11px] font-sans font-semibold text-[#483828] flex items-center gap-1 shadow-2xs">
                        <Clock size={12} className="text-[#87380F]" />
                        <span>{recipe.prepTime}</span>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="flex items-center gap-3 text-xs text-[#647044] font-semibold mb-2">
                        <span className="flex items-center gap-1">
                          <ChefHat size={14} />
                          {recipe.difficulty}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {recipe.servings}
                        </span>
                      </div>

                      <h3 className="font-serif text-xl font-bold text-[#483828] group-hover:text-[#87380F] transition-colors leading-snug">
                        {recipe.title}
                      </h3>

                      <p className="text-xs text-[#483828]/80 font-sans mt-2 line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>

                      {relatedProduct && (
                        <div className="mt-4 pt-3 border-t border-[#EBD9BC]/60 flex items-center gap-2 text-xs text-[#87380F]">
                          <Sparkles size={13} />
                          <span className="font-medium">Made with: {relatedProduct.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 pt-0">
                    <Link
                      to={`/recipes/${recipe.slug}`}
                      className="w-full py-2.5 bg-[#FAF6F0] hover:bg-[#87380F] text-[#87380F] hover:text-white border border-[#EBD9BC] hover:border-[#87380F] rounded-md text-xs font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
                    >
                      <span>View Recipe &amp; Steps</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Detailed Recipe Modal */}
        {selectedRecipe && (
          <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-10 font-sans">
            <div
              className="fixed inset-0 bg-[#483828]/70 backdrop-blur-xs transition-opacity"
              onClick={() => navigate('/recipes')}
            />

            <div className="relative max-w-3xl mx-auto bg-[#FAF6F0] rounded-2xl shadow-2xl border border-[#EBD9BC] overflow-hidden">
              {/* Modal Header */}
              <div className="relative aspect-[21/9] sm:aspect-[21/8] overflow-hidden bg-[#EBD9BC]">
                <img
                  src={selectedRecipe.image}
                  alt={selectedRecipe.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#483828]/90 via-[#483828]/40 to-transparent" />

                <button
                  type="button"
                  onClick={() => navigate('/recipes')}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#FAF6F0]/90 text-[#483828] hover:text-[#87380F] flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="absolute bottom-4 left-6 right-6 text-white">
                  <span className="text-xs uppercase tracking-widest font-semibold text-[#B69A55]">
                    Traditional South Indian Dish
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-tight">
                    {selectedRecipe.title}
                  </h2>
                </div>
              </div>

              {/* Recipe Meta details */}
              <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#483828] pb-4 border-b border-[#EBD9BC]">
                  <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded border border-[#EBD9BC]">
                    <Clock size={14} className="text-[#87380F]" /> Prep Time: {selectedRecipe.prepTime}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded border border-[#EBD9BC]">
                    <ChefHat size={14} className="text-[#87380F]" /> Difficulty: {selectedRecipe.difficulty}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded border border-[#EBD9BC]">
                    <Users size={14} className="text-[#87380F]" /> Servings: {selectedRecipe.servings}
                  </span>
                </div>

                {/* Related Product Callout */}
                {getProductForRecipe(selectedRecipe) && (
                  <div className="bg-[#F7EFE1] p-4 rounded-xl border border-[#EBD9BC] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={getProductForRecipe(selectedRecipe)!.image}
                        alt="Product"
                        className="w-14 h-14 rounded-md object-cover bg-white"
                      />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#87380F]">Recommended Blend</span>
                        <h4 className="font-serif text-sm font-bold text-[#483828]">
                          {getProductForRecipe(selectedRecipe)!.name}
                        </h4>
                        <span className="text-xs font-serif text-[#87380F] font-bold">
                          {formatPaise(getProductForRecipe(selectedRecipe)!.variants[0].pricePaise)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        addToCart(getProductForRecipe(selectedRecipe)!, '100g', 1);
                      }}
                      className="px-4 py-2 bg-[#87380F] hover:bg-[#662707] text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      <ShoppingBag size={13} />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                )}

                {/* Ingredients Checklist */}
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#483828] mb-3">
                    Ingredients Checklist (Tap to tick off)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <div
                        key={i}
                        onClick={() => toggleIngredientCheck(ing)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                          checkedIngredients[ing]
                            ? 'bg-[#647044]/15 border-[#647044]/30 line-through text-[#647044]'
                            : 'bg-white border-[#EBD9BC] text-[#483828] hover:border-[#87380F]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            checkedIngredients[ing]
                              ? 'bg-[#647044] border-[#647044] text-white'
                              : 'border-[#483828]/40'
                          }`}
                        >
                          {checkedIngredients[ing] && <Check size={11} />}
                        </div>
                        <span className="font-medium">{ing}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#483828] mb-3">
                    Step-by-Step Cooking Instructions
                  </h3>
                  <ol className="space-y-3">
                    {selectedRecipe.instructions.map((step, idx) => (
                      <li
                        key={idx}
                        className="flex gap-3 text-xs sm:text-sm text-[#483828]/85 leading-relaxed bg-white p-3.5 rounded-xl border border-[#EBD9BC]"
                      >
                        <span className="w-6 h-6 rounded-full bg-[#87380F] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Chef tips */}
                {selectedRecipe.chefTip && (
                  <div className="bg-[#FAF6F0] p-4 rounded-xl border-l-4 border-[#B69A55] border-y border-r border-[#EBD9BC] space-y-1 text-xs text-[#483828]">
                    <span className="font-serif font-bold text-[#87380F] text-sm flex items-center gap-1.5">
                      <Sparkles size={14} /> Traditional Grandmother's Secret:
                    </span>
                    <p className="leading-relaxed font-sans">{selectedRecipe.chefTip}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
